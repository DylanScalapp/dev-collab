import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit3, MessageSquare, Paperclip, Save, X } from 'lucide-react';
import { TaskForm } from '@/components/forms/TaskForm';
import { useToast } from '@/hooks/use-toast';

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

interface Subtask {
  id: string;
  title: string;
  description: string;
  is_completed: boolean;
  created_by: string;
  task_id: string;
}

interface Message {
  id: string;
  content: string;
  file_name?: string;
  file_url?: string;
  sender_id: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string; email: string };
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface TaskDetailsProps {
  task: Task;
  onTaskUpdate: () => void;
}

export function TaskDetails({ task, onTaskUpdate }: TaskDetailsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('TaskDetails mounting for task:', task.id);
    fetchSubtasks();
    fetchMessages();
    fetchUsers();
  }, [task.id]);

  const fetchSubtasks = async () => {
    console.log('Fetching subtasks for task:', task.id);
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Subtasks fetch error:', error);
        throw error;
      }
      console.log('Subtasks fetched:', data);
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
    }
  };

  const fetchMessages = async () => {
    console.log('Fetching messages for task:', task.id);
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('id, content, file_name, file_url, sender_id, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Messages fetch error:', error);
        throw error;
      }
      console.log('Messages fetched:', messagesData);

      // Get profiles separately for each sender
      const senderIds = messagesData?.map(m => m.sender_id) || [];
      console.log('Fetching profiles for senders:', senderIds);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', senderIds);

      if (profilesError) {
        console.error('Profiles fetch error:', profilesError);
        throw profilesError;
      }
      console.log('Profiles fetched:', profilesData);

      // Combine messages with profile data
      const messagesWithProfiles = messagesData?.map(message => ({
        ...message,
        profiles: profilesData?.find(p => p.user_id === message.sender_id) || {
          first_name: 'Utilisateur',
          last_name: 'Inconnu',
          email: 'inconnu@email.com'
        }
      })) || [];

      console.log('Combined messages with profiles:', messagesWithProfiles);
      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchUsers = async () => {
    console.log('Fetching users...');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('is_approved', true);

      if (error) {
        console.error('Users fetch error:', error);
        throw error;
      }
      console.log('Users fetched:', data);
      
      const formattedUsers = (data || []).map(profile => ({
        id: profile.user_id,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email,
      }));
      
      console.log('Formatted users:', formattedUsers);
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ is_completed: !isCompleted })
        .eq('id', subtaskId);

      if (error) throw error;
      
      setSubtasks(prev => prev.map(subtask => 
        subtask.id === subtaskId 
          ? { ...subtask, is_completed: !isCompleted }
          : subtask
      ));

      toast({
        title: "Sous-tâche mise à jour",
        description: "Le statut de la sous-tâche a été modifié.",
      });
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la sous-tâche.",
        variant: "destructive",
      });
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          title: newSubtaskTitle,
          task_id: task.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setSubtasks(prev => [...prev, data]);
      setNewSubtaskTitle('');

      toast({
        title: "Sous-tâche ajoutée",
        description: "La nouvelle sous-tâche a été créée.",
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la sous-tâche.",
        variant: "destructive",
      });
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const addMessage = async () => {
    if (!newMessage.trim() && !fileToUpload || !user) return;

    try {
      let fileUrl = null;
      let fileName = null;

      if (fileToUpload) {
        fileUrl = await uploadFile(fileToUpload);
        fileName = fileToUpload.name;
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage || 'Fichier joint',
          task_id: task.id,
          sender_id: user.id,
          file_url: fileUrl,
          file_name: fileName,
        });

      if (error) throw error;
      
      fetchMessages(); // Refresh to ensure consistency
      setNewMessage('');
      setFileToUpload(null);

      toast({
        title: "Commentaire ajouté",
        description: "Votre commentaire a été publié.",
      });
    } catch (error) {
      console.error('Error adding message:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire.",
        variant: "destructive",
      });
    }
  };

  const statusConfig = {
    todo: { label: 'À faire', color: 'bg-gray-100 text-gray-800' },
    in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
    review: { label: 'À revoir', color: 'bg-yellow-100 text-yellow-800' },
    to_modify: { label: 'À modifier', color: 'bg-orange-100 text-orange-800' },
    completed: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' }
  };

  const assignedUser = users.find(u => u.id === task.assigned_to);
  const completedSubtasks = subtasks.filter(s => s.is_completed).length;

  if (loading) {
    console.log('TaskDetails is still loading...');
    return <div className="p-6">Chargement...</div>;
  }

  console.log('TaskDetails rendering with data:', { subtasks, messages, users });

  return (
    <div className="px-6 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{task.title}</h2>
          <div className="flex items-center gap-2">
            <Badge className={statusConfig[task.status].color}>
              {statusConfig[task.status].label}
            </Badge>
            <Badge variant="outline">{task.priority}</Badge>
            <span className="text-sm text-muted-foreground">
              Projet: {task.projects?.name}
            </span>
          </div>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Edit3 className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier la tâche</DialogTitle>
            </DialogHeader>
            <TaskForm
              task={task}
              onSubmit={() => {
                setIsEditDialogOpen(false);
                onTaskUpdate();
              }}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Description */}
      {task.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{task.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Task Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignedUser && (
            <div className="flex justify-between">
              <span className="text-sm font-medium">Assigné à:</span>
              <span className="text-sm">{assignedUser.first_name} {assignedUser.last_name}</span>
            </div>
          )}
          {task.due_date && (
            <div className="flex justify-between">
              <span className="text-sm font-medium">Date d'échéance:</span>
              <span className="text-sm">{new Date(task.due_date).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm font-medium">Créé le:</span>
            <span className="text-sm">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Subtasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Sous-tâches ({completedSubtasks}/{subtasks.length})
            <Button 
              variant="outline" 
              size="sm"
              onClick={addSubtask}
              disabled={!newSubtaskTitle.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nouvelle sous-tâche..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
              className="flex-1"
            />
          </div>
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-3 p-2 rounded border">
                <Checkbox
                  checked={subtask.is_completed}
                  onCheckedChange={() => toggleSubtask(subtask.id, subtask.is_completed)}
                />
                <span className={`flex-1 ${subtask.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                  {subtask.title}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Commentaires ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add comment */}
          <div className="space-y-3">
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Joindre un fichier
                  </span>
                </Button>
              </label>
              {fileToUpload && (
                <span className="text-sm text-muted-foreground">
                  {fileToUpload.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFileToUpload(null)}
                    className="ml-2 h-auto p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </span>
              )}
              <Button 
                onClick={addMessage}
                disabled={!newMessage.trim() && !fileToUpload}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Publier
              </Button>
            </div>
          </div>

          <Separator />

          {/* Messages list */}
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-sm">
                    {message.profiles?.first_name} {message.profiles?.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleString()}
                  </div>
                </div>
                <p className="text-sm mb-2">{message.content}</p>
                {message.file_url && message.file_name && (
                  <a
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Paperclip className="h-3 w-3" />
                    {message.file_name}
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}