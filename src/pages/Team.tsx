import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Search, UserPlus, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { log } from 'console';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'developer' | 'admin';
  is_approved: boolean;
  created_at: string;
}

export default function Team() {
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (userId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: approve })
        .eq('user_id', userId);

      if (error) throw error;

      setMembers(prev => prev.map(member => 
        member.user_id === userId ? { ...member, is_approved: approve } : member
      ));

      toast({
        title: approve ? "Utilisateur approuvé" : "Approbation révoquée",
        description: `L'utilisateur a été ${approve ? 'approuvé' : 'désapprouvé'}.`,
      });
    } catch (error) {
      console.error('Error updating approval:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'approbation.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Supprimer le profil (cascade supprimera aussi l'utilisateur auth)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setMembers(prev => prev.filter(member => member.user_id !== userId));

      toast({
        title: "Utilisateur supprimé",
        description: "L'utilisateur a été supprimé définitivement.",
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur.",
        variant: "destructive"
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'developer' | 'admin') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setMembers(prev => prev.map(member => 
        member.user_id === userId ? { ...member, role: newRole } : member
      ));

      toast({
        title: "Rôle mis à jour",
        description: `Le rôle a été changé vers ${newRole === 'admin' ? 'Administrateur' : 'Développeur'}.`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le rôle.",
        variant: "destructive"
      });
    }
  };

  // Filter members
  const filteredMembers = members.filter(member => {
    const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
    const email = member.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  // Group members by approval status
  const approvedMembers = filteredMembers.filter(m => m.is_approved);
  const pendingMembers = filteredMembers.filter(m => !m.is_approved);

  

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
          <h1 className="text-2xl font-bold">Mon équipe</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {approvedMembers.length} membres actifs
            </Badge>
            {pendingMembers.length > 0 && (
              <Badge variant="secondary">
                {pendingMembers.length} en attente
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des membres..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Pending approvals for admins */}
      {isAdmin && approvedMembers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-orange-600">
            En attente d'approbation ({pendingMembers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingMembers.map(member => (
              <Card key={member.id} className="border-orange-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {member.first_name} {member.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(member.user_id, true)}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUser(member.user_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active team members */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Membres de l'équipe ({approvedMembers.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {approvedMembers.map(member => (
            <Card key={member.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {member.first_name} {member.last_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role === 'admin' ? 'Admin' : 'Dev'}
                  </Badge>
                </div>
              </CardHeader>
              {isAdmin && (
                <CardContent>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Modifier le membre</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Rôle</label>
                            <Select 
                              value={member.role} 
                              onValueChange={(value: 'developer' | 'admin') => 
                                handleRoleChange(member.user_id, value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="developer">Développeur</SelectItem>
                                <SelectItem value="admin">Administrateur</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleApproval(member.user_id, false)}
                            >
                              Désactiver
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
      
      


      {/* Empty state */}
      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Aucun membre trouvé</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Essayez de modifier votre recherche.' : 'L\'équipe est vide pour le moment.'}
          </p>
        </div>
      )}
    </div>
  );
}