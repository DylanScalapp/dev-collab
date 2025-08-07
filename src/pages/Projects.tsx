import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, FolderOpen, Users, Calendar, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectForm } from '@/components/forms/ProjectForm';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  project_members: Array<{
    user_id: string;
    is_leader: boolean;
    profiles: {
      first_name: string;
      last_name: string;
      email: string;
    };
  }>;
  task_count?: number;
}

export default function Projects() {
  const { isAdmin, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      // Fetch projects first
      let projectQuery = supabase
        .from('projects')
        .select('*');

      // If not admin, filter by user's projects through project_members
      if (!isAdmin && user) {
        const { data: userProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id);
        
        const projectIds = userProjects?.map(p => p.project_id) || [];
        if (projectIds.length === 0) {
          setProjects([]);
          return;
        }
        projectQuery = projectQuery.in('id', projectIds);
      }

      const { data: projectsData, error: projectsError } = await projectQuery
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch project members with profiles for each project
      const projectsWithMembers = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: members } = await supabase
            .from('project_members')
            .select(`
              user_id,
              is_leader,
              profiles!inner(
                first_name,
                last_name,
                email
              )
            `)
            .eq('project_id', project.id);

          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id);
          
          return { 
            ...project, 
            project_members: members || [], 
            task_count: count || 0 
          };
        })
      );

      setProjects(projectsWithMembers as any);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter projects
  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projets</h1>
          {isAdmin && (
            <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau projet
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer un nouveau projet</DialogTitle>
                </DialogHeader>
                <ProjectForm
                  onSubmit={() => {
                    setIsProjectDialogOpen(false);
                    fetchProjects();
                  }}
                  onCancel={() => setIsProjectDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des projets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(project => (
          <Card key={project.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2 flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    {project.name}
                  </CardTitle>
                  <Badge 
                    variant={project.status === 'active' ? 'default' : 'secondary'}
                    className="mb-2"
                  >
                    {project.status === 'active' ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Project Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {project.project_members.length} membres
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {project.task_count} tâches
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <p className="text-sm font-medium mb-2">Équipe</p>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {project.project_members.slice(0, 3).map((member, idx) => (
                        <Avatar key={idx} className="h-8 w-8 border-2 border-background">
                          <AvatarFallback className="text-xs">
                            {member.profiles.first_name?.[0]}{member.profiles.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {project.project_members.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{project.project_members.length - 3} autres
                      </span>
                    )}
                  </div>
                  
                  {/* Leaders */}
                  <div className="mt-2">
                    {project.project_members
                      .filter(member => member.is_leader)
                      .map((leader, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs mr-1">
                          👑 {leader.profiles.first_name} {leader.profiles.last_name}
                        </Badge>
                      ))
                    }
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link to={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-1" />
                      Voir les tâches
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Button variant="ghost" size="sm">
                      ⚙️
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Aucun projet trouvé</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Essayez de modifier votre recherche.' : 'Aucun projet disponible pour le moment.'}
          </p>
          {isAdmin && !searchTerm && (
            <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le premier projet
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer un nouveau projet</DialogTitle>
                </DialogHeader>
                <ProjectForm
                  onSubmit={() => {
                    setIsProjectDialogOpen(false);
                    fetchProjects();
                  }}
                  onCancel={() => setIsProjectDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}