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
import { cn } from '@/lib/utils';

const taskSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  project_id: z.string().uuid('Veuillez sélectionner un projet'),
  assigned_to: z.string().uuid().optional(),
  due_date: z.date().optional(),
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
  assigned_to: string;
  due_date: string;
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
      assigned_to: task.assigned_to || undefined,
      due_date: task.due_date ? new Date(task.due_date) : undefined,
    } : {
      title: '',
      description: '',
      priority: 'medium',
      project_id: '',
      assigned_to: undefined,
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
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title: data.title,
            description: data.description || null,
            priority: data.priority,
            project_id: data.project_id,
            assigned_to: data.assigned_to || null,
            due_date: data.due_date?.toISOString() || null,
          })
          .eq('id', task.id);

        if (error) throw error;

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
          assigned_to: data.assigned_to || null,
          due_date: data.due_date?.toISOString() || null,
          created_by: user.id,
          status: 'todo' as const,
        };

        const { error } = await supabase
          .from('tasks')
          .insert([taskData]);

        if (error) throw error;

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
          name="assigned_to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assigné à</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur (optionnel)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email})
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
          name="due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date d'échéance</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: undefined })
                      ) : (
                        <span>Sélectionner une date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

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