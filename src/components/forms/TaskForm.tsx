import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { createTaskAssignmentNotifications } from '@/utils/notificationManager';

const taskSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  project_id: z.string().uuid('Veuillez sélectionner un projet'),
  assigned_users: z.array(z.string().uuid()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) >= new Date(data.start_date);
  }
  return true;
}, {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["end_date"]
});

type TaskFormData = z.infer<typeof taskSchema>;

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'to_modify' | 'completed' | 'cancelled';
  priority: string;
  project_id: string;
  start_date?: string;
  end_date?: string;
}

interface TaskFormProps {
  task?: Task;
  onSubmit: () => void;
  onCancel: () => void;
}

const priorityOptions = [
  { value: 'low', label: 'Faible', color: 'text-green-600' },
  { value: 'medium', label: 'Moyenne', color: 'text-yellow-600' },
  { value: 'high', label: 'Élevée', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' },
];

export function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ? {
      title: task.title,
      description: task.description,
      priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
      project_id: task.project_id,
      assigned_users: [], // Will be loaded from task_assignments
      start_date: task.start_date || '',
      end_date: task.end_date || '',
    } : {
      title: '',
      description: '',
      priority: 'medium',
      project_id: '',
      assigned_users: [],
      start_date: '',
      end_date: '',
    },
  });

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les projets',
        variant: 'destructive',
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('is_approved', true)
        .order('first_name');

      if (error) throw error;
      
      const formattedUsers = (data || []).map(profile => ({
        id: profile.user_id,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email,
      }));
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: TaskFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      if (task) {
        // Get current assignments to detect new ones
        const { data: currentAssignments } = await supabase
          .from('task_assignments')
          .select('user_id')
          .eq('task_id', task.id);
        
        const currentUserIds = currentAssignments?.map(a => a.user_id) || [];
        const newUserIds = data.assigned_users.filter(userId => !currentUserIds.includes(userId));

        // Update existing task
        const { error: taskError } = await supabase
          .from('tasks')
          .update({
            title: data.title,
            description: data.description || null,
            priority: data.priority,
            project_id: data.project_id,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
          })
          .eq('id', task.id);

        if (taskError) throw taskError;

        // Update task assignments
        // First delete existing assignments
        await supabase
          .from('task_assignments')
          .delete()
          .eq('task_id', task.id);

        // Then insert new assignments
        if (data.assigned_users.length > 0) {
          const assignments = data.assigned_users.map(userId => ({
            task_id: task.id,
            user_id: userId,
          }));

          const { error: assignError } = await supabase
            .from('task_assignments')
            .insert(assignments);

          if (assignError) throw assignError;

          // Create notifications for newly assigned users
          if (newUserIds.length > 0) {
            await createTaskAssignmentNotifications(task.id, data.title, newUserIds);
          }
        }

        toast({
          title: 'Succès',
          description: 'La tâche a été mise à jour avec succès',
        });
      } else {
        // Create new task
        const taskData = {
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          project_id: data.project_id,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          created_by: user.id,
          status: 'todo' as const,
        };

        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert([taskData])
          .select()
          .single();

        if (taskError) throw taskError;

        // Create task assignments if any
        if (data.assigned_users.length > 0) {
          const assignments = data.assigned_users.map(userId => ({
            task_id: newTask.id,
            user_id: userId,
          }));

          const { error: assignError } = await supabase
            .from('task_assignments')
            .insert(assignments);

          if (assignError) throw assignError;

          // Create notifications for assigned users
          await createTaskAssignmentNotifications(newTask.id, data.title, data.assigned_users);
        }

        toast({
          title: 'Succès',
          description: 'La tâche a été créée avec succès',
        });
      }

      onSubmit();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: 'Erreur',
        description: `Impossible de ${task ? 'modifier' : 'créer'} la tâche`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titre *</FormLabel>
              <FormControl>
                <Input placeholder="Titre de la tâche" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Description détaillée de la tâche"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une priorité" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={option.color}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="project_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Projet *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un projet" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="assigned_users"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Développeurs assignés</FormLabel>
              <div className="space-y-2">
                {field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {field.value.map((userId) => {
                      const user = users.find(u => u.id === userId);
                      return user ? (
                        <Badge key={userId} variant="secondary" className="text-xs">
                          {user.first_name} {user.last_name}
                          <button
                            type="button"
                            onClick={() => {
                              const newValue = field.value.filter(id => id !== userId);
                              field.onChange(newValue);
                            }}
                            className="ml-1 text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                <Select onValueChange={(value) => {
                  if (value && !field.value.includes(value)) {
                    field.onChange([...field.value, value]);
                  }
                }}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter un développeur" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users
                      .filter(user => !field.value.includes(user.id))
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date et heure de début</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date et heure de fin</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : task ? (
              'Modifier la tâche'
            ) : (
              'Créer la tâche'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}