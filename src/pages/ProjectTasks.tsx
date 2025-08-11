import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'to_modify' | 'completed' | 'cancelled';
  priority: string;
  due_date: string;
  assigned_to: string;
  created_at: string;
  assigned_profile?: {
    first_name: string;
    last_name: string;
  };
}

interface Project {
  id: string;
  name: string;
  description: string;
}

export default function ProjectTasks() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchProjectAndTasks();
    }
  }, [projectId]);

  const fetchProjectAndTasks = async () => {
    try {
      // Fetch project info
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch tasks for this project
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch assigned profiles separately
      const tasksWithProfiles = await Promise.all(
        (tasksData || []).map(async (task) => {
          let assigned_profile = null;
          if (task.assigned_to) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', task.assigned_to)
              .single();
            assigned_profile = profileData;
          }
          return { ...task, assigned_profile };
        })
      );

      setTasks(tasksWithProfiles);
    } catch (error) {
      console.error('Error fetching project tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'review':
        return <AlertTriangle className="h-4 w-4 text-purple-500" />;
      case 'to_modify':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Terminé';
      case 'in_progress':
        return 'En cours';
      case 'review':
        return 'En révision';
      case 'to_modify':
        return 'À modifier';
      case 'cancelled':
        return 'Annulé';
      default:
        return 'À faire';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">Projet non trouvé</h3>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux projets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/projects')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux projets
        </Button>
        
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground mt-2">{project.description}</p>
        )}
        <div className="mt-4">
          <Badge variant="outline">{tasks.length} tâche(s)</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.map(task => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    {task.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getStatusText(task.status) as any}>
                      {getStatusText(task.status)}
                    </Badge>
                    <Badge variant={getPriorityColor(task.priority) as any}>
                      {task.priority === 'high' ? 'Haute' : task.priority === 'medium' ? 'Moyenne' : 'Basse'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {task.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {task.description}
                </p>
              )}
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  {task.assigned_profile && (
                    <span>
                      Assigné à: {task.assigned_profile.first_name} {task.assigned_profile.last_name}
                    </span>
                  )}
                </div>
                <div>
                  {task.due_date && (
                    <span>Échéance: {new Date(task.due_date).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Aucune tâche</h3>
          <p className="text-muted-foreground">
            Ce projet n'a pas encore de tâches.
          </p>
        </div>
      )}
    </div>
  );
}