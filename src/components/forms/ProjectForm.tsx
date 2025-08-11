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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { Loader2, X, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const projectSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  priority: z.enum(['low', 'medium', 'high']),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
  members: z.array(z.string().uuid()),
  leaders: z.array(z.string().uuid()),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return data.end_date >= data.start_date;
  }
  return true;
}, {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["end_date"]
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ProjectFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

export function ProjectForm({ onSubmit, onCancel }: ProjectFormProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
      priority: 'medium',
      start_date: undefined,
      end_date: undefined,
      members: [],
      leaders: [],
    },
  });

  const watchedMembers = form.watch('members');
  const watchedLeaders = form.watch('leaders');

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleMemberToggle = (userId: string, isChecked: boolean) => {
    const currentMembers = form.getValues('members');
    const currentLeaders = form.getValues('leaders');
    
    if (isChecked) {
      form.setValue('members', [...currentMembers, userId]);
    } else {
      form.setValue('members', currentMembers.filter(id => id !== userId));
      // Remove from leaders if also a leader
      if (currentLeaders.includes(userId)) {
        form.setValue('leaders', currentLeaders.filter(id => id !== userId));
      }
    }
  };

  const handleLeaderToggle = (userId: string, isChecked: boolean) => {
    const currentLeaders = form.getValues('leaders');
    const currentMembers = form.getValues('members');
    
    if (isChecked) {
      // Add as leader and ensure they're also a member
      form.setValue('leaders', [...currentLeaders, userId]);
      if (!currentMembers.includes(userId)) {
        form.setValue('members', [...currentMembers, userId]);
      }
    } else {
      form.setValue('leaders', currentLeaders.filter(id => id !== userId));
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Utilisateur inconnu';
  };

  const handleSubmit = async (data: ProjectFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      // Create the project
      const projectData = {
        name: data.name,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        start_date: data.start_date?.toISOString() || null,
        end_date: data.end_date?.toISOString() || null,
        created_by: user.id,
      };

      const { data: projectResult, error: projectError } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (projectError) throw projectError;

      // Add project members
      if (data.members.length > 0) {
        const membersData = data.members.map(userId => ({
          project_id: projectResult.id,
          user_id: userId,
          is_leader: data.leaders.includes(userId),
        }));

        const { error: membersError } = await supabase
          .from('project_members')
          .insert(membersData);

        if (membersError) throw membersError;
      }

      toast({
        title: 'Succès',
        description: 'Le projet a été créé avec succès',
      });

      onSubmit();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le projet',
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom du projet *</FormLabel>
              <FormControl>
                <Input placeholder="Nom du projet" {...field} />
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
                  placeholder="Description du projet"
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    <SelectItem value="low">🟢 Basse</SelectItem>
                    <SelectItem value="medium">🟡 Moyenne</SelectItem>
                    <SelectItem value="high">🔴 Haute</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date de début</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: fr })
                        ) : (
                          <span>Choisir une date</span>
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
                      disabled={(date) =>
                        date < new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date de fin</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: fr })
                        ) : (
                          <span>Choisir une date</span>
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
                      disabled={(date) =>
                        date < new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <FormLabel>Membres de l'équipe</FormLabel>
          
          {/* Selected members */}
          {watchedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
              {watchedMembers.map(userId => (
                <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                  {getUserName(userId)}
                  {watchedLeaders.includes(userId) && <span className="text-xs">👑</span>}
                  <button
                    type="button"
                    onClick={() => handleMemberToggle(userId, false)}
                    className="ml-1 hover:bg-background rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Users list */}
          <div className="max-h-60 overflow-y-auto border rounded-lg">
            {users.map((userItem) => (
              <div key={userItem.id} className="flex items-center space-x-3 p-3 border-b last:border-b-0">
                <Checkbox
                  id={`member-${userItem.id}`}
                  checked={watchedMembers.includes(userItem.id)}
                  onCheckedChange={(checked) => handleMemberToggle(userItem.id, checked as boolean)}
                />
                <div className="flex-1">
                  <label htmlFor={`member-${userItem.id}`} className="text-sm font-medium cursor-pointer">
                    {userItem.first_name} {userItem.last_name}
                  </label>
                  <p className="text-xs text-muted-foreground">{userItem.email}</p>
                </div>
                {watchedMembers.includes(userItem.id) && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`leader-${userItem.id}`}
                      checked={watchedLeaders.includes(userItem.id)}
                      onCheckedChange={(checked) => handleLeaderToggle(userItem.id, checked as boolean)}
                    />
                    <label htmlFor={`leader-${userItem.id}`} className="text-xs cursor-pointer">
                      Chef de projet
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
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
            ) : (
              'Créer le projet'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}