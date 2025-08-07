import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, FolderOpen, Users, TrendingUp } from 'lucide-react';

interface DashboardStats {
  activeTasks: number;
  activeProjects: number;
  teamMembers: number;
  completedTasks: number;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeTasks: 0,
    activeProjects: 0,
    teamMembers: 0,
    completedTasks: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get active tasks count
        const { count: activeTasksCount } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .in('status', ['todo', 'in_progress', 'review', 'to_modify']);

        // Get completed tasks count
        const { count: completedTasksCount } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');

        // Get active projects count
        const { count: activeProjectsCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // Get team members count (only approved users)
        const { count: teamMembersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_approved', true);

        setStats({
          activeTasks: activeTasksCount || 0,
          activeProjects: activeProjectsCount || 0,
          teamMembers: teamMembersCount || 0,
          completedTasks: completedTasksCount || 0
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const dashboardCards = [
    {
      title: 'Tâches en cours',
      value: stats.activeTasks,
      icon: CheckSquare,
      description: 'Tâches actives à traiter',
      color: 'text-blue-600'
    },
    {
      title: 'Projets actifs',
      value: stats.activeProjects,
      icon: FolderOpen,
      description: 'Projets en cours',
      color: 'text-green-600'
    },
    {
      title: 'Membres équipe',
      value: stats.teamMembers,
      icon: Users,
      description: 'Membres approuvés',
      color: 'text-purple-600'
    },
    {
      title: 'Tâches terminées',
      value: stats.completedTasks,
      icon: TrendingUp,
      description: 'Tâches accomplies',
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Tableau de bord
        </h1>
        <p className="text-muted-foreground">
          Bienvenue {profile?.first_name}, voici un aperçu de vos projets et tâches.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {dashboardCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Actions d'administration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium">Gérer l'équipe</h3>
                <p className="text-sm text-muted-foreground">
                  Approuver et gérer les membres
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <h3 className="font-medium">Créer un projet</h3>
                <p className="text-sm text-muted-foreground">
                  Nouveau projet avec équipe
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-medium">Assigner tâches</h3>
                <p className="text-sm text-muted-foreground">
                  Créer et assigner des tâches
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}