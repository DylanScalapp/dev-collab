import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Plus, Search, Filter } from 'lucide-react';
import { TaskForm } from '@/components/forms/TaskForm';
import { TaskDetails } from '@/components/TaskDetails';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'to_modify' | 'completed' | 'cancelled';
  priority: string;
  project_id: string;
  created_by: string;
  assigned_to: string;
  due_date: string;
  created_at: string;
  projects: { name: string };
}

interface Project {
  id: string;
  name: string;
}

const statusConfig = {
  todo: { label: 'À faire', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  review: { label: 'À revoir', color: 'bg-yellow-100 text-yellow-800' },
  to_modify: { label: 'À modifier', color: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' }
};

function TaskCard({ task, onTaskClick }: { task: Task; onTaskClick: (task: Task) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-4 bg-card rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
        isDragging && "opacity-50"
      )}
      onClick={(e) => {
        // Only trigger task details if not dragging
        if (!isDragging && e.detail === 1) {
          onTaskClick(task);
        }
      }}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-sm">{task.title}</h3>
          <Badge className={statusConfig[task.status].color}>
            {statusConfig[task.status].label}
          </Badge>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{task.projects?.name}</span>
          <Badge variant="outline" className="text-xs">
            {task.priority}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function StatusColumn({ status, tasks, title, onTaskClick }: { 
  status: string; 
  tasks: Task[]; 
  title: string;
  onTaskClick: (task: Task) => void;
}) {
  return (
    <div className="flex-1 min-w-80">
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">{title}</h2>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} onTaskClick={onTaskClick} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function Tasks() {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects!inner(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as Task['status'];

    // Update optimistically
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        // Revert on error
        fetchTasks();
        throw error;
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = selectedProject === 'all' || task.project_id === selectedProject;
    return matchesSearch && matchesProject;
  });

  // Group tasks by status
  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    review: filteredTasks.filter(t => t.status === 'review'),
    to_modify: filteredTasks.filter(t => t.status === 'to_modify'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
    cancelled: filteredTasks.filter(t => t.status === 'cancelled')
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mes tâches</h1>
          {isAdmin && (
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer une nouvelle tâche</DialogTitle>
                </DialogHeader>
                <TaskForm
                  onSubmit={() => {
                    setIsTaskDialogOpen(false);
                    fetchTasks();
                  }}
                  onCancel={() => setIsTaskDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des tâches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full sm:w-64">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrer par projet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les projets</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-6">
          <StatusColumn
            status="todo"
            tasks={tasksByStatus.todo}
            title="À faire"
            onTaskClick={setSelectedTask}
          />
          <StatusColumn
            status="in_progress"
            tasks={tasksByStatus.in_progress}
            title="En cours"
            onTaskClick={setSelectedTask}
          />
          <StatusColumn
            status="review"
            tasks={tasksByStatus.review}
            title="À revoir"
            onTaskClick={setSelectedTask}
          />
          <StatusColumn
            status="to_modify"
            tasks={tasksByStatus.to_modify}
            title="À modifier"
            onTaskClick={setSelectedTask}
          />
          <StatusColumn
            status="completed"
            tasks={tasksByStatus.completed}
            title="Terminé"
            onTaskClick={setSelectedTask}
          />
          <StatusColumn
            status="cancelled"
            tasks={tasksByStatus.cancelled}
            title="Annulé"
            onTaskClick={setSelectedTask}
          />
        </div>
      </DndContext>

      {/* Task Details Drawer */}
      <Drawer open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DrawerContent className="max-h-[95vh] h-[95vh]">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>Détails de la tâche</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto">
            {selectedTask && (
              <TaskDetails 
                task={selectedTask} 
                onTaskUpdate={() => {
                  fetchTasks();
                  setSelectedTask(null);
                }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}