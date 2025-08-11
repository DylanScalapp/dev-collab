import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Edit, Users, Calendar, FolderOpen } from 'lucide-react';

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

interface ProjectSettingsDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
}

export function ProjectSettingsDialog({ 
  project, 
  isOpen, 
  onClose, 
  onProjectUpdated 
}: ProjectSettingsDialogProps) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState({
    name: project.name,
    description: project.description || '',
    status: project.status
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEditedProject({
      name: project.name,
      description: project.description || '',
      status: project.status
    });
    setIsEditing(false);
  }, [project]);

  const handleSave = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editedProject.name,
          description: editedProject.description,
          status: editedProject.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: "Projet mis à jour",
        description: "Les modifications ont été enregistrées avec succès.",
      });

      setIsEditing(false);
      onProjectUpdated();
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le projet.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Paramètres du projet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nom du projet</Label>
              {isEditing ? (
                <Input
                  id="project-name"
                  value={editedProject.name}
                  onChange={(e) => setEditedProject(prev => ({ ...prev, name: e.target.value }))}
                  disabled={loading}
                />
              ) : (
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{project.name}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              {isEditing ? (
                <Textarea
                  id="project-description"
                  value={editedProject.description}
                  onChange={(e) => setEditedProject(prev => ({ ...prev, description: e.target.value }))}
                  disabled={loading}
                  rows={3}
                />
              ) : (
                <div className="p-3 bg-muted rounded-md min-h-[80px]">
                  <p className="text-muted-foreground">
                    {project.description || 'Aucune description'}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-status">Statut</Label>
              {isEditing ? (
                <Select
                  value={editedProject.status}
                  onValueChange={(value) => setEditedProject(prev => ({ ...prev, status: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-muted rounded-md">
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status === 'active' ? 'Actif' : 
                     project.status === 'completed' ? 'Terminé' : 'Inactif'}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Project Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <Users className="h-4 w-4" />
                Membres d'équipe
              </div>
              <p className="text-2xl font-bold">{project.project_members.length}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <Calendar className="h-4 w-4" />
                Tâches
              </div>
              <p className="text-2xl font-bold">{project.task_count || 0}</p>
            </div>
          </div>

          {/* Team Members */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Équipe du projet
            </h4>
            <div className="space-y-2">
              {project.project_members.map((member, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-sm">
                      {member.profiles.first_name?.[0]}{member.profiles.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {member.profiles.first_name} {member.profiles.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.profiles.email}
                    </p>
                  </div>
                  {member.is_leader && (
                    <Badge variant="outline" className="text-xs">
                      👑 Leader
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Project Metadata */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium">Créé le:</span>{' '}
              {new Date(project.created_at).toLocaleDateString('fr-FR')}
            </p>
            <p>
              <span className="font-medium">Dernière modification:</span>{' '}
              {new Date(project.updated_at).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {/* Actions */}
          {isAdmin && (
            <div className="flex gap-2 pt-4 border-t">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={loading} className="flex-1">
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditedProject({
                        name: project.name,
                        description: project.description || '',
                        status: project.status
                      });
                    }}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier le projet
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}