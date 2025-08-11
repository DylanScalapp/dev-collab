import { useState, useEffect, useRef } from 'react';
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
  start_date?: string;
  end_date?: string;
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    console.log('TaskDetails mounting for task:', task.id);
    fetchSubtasks();
    fetchMessages();
    fetchUsers();

    // Realtime subscription for messages
    const messagesChannel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `task_id=eq.${task.id}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    // Realtime subscription for subtasks
    const subtasksChannel = supabase
      .channel('subtasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subtasks',
          filter: `task_id=eq.${task.id}`,
        },
        () => fetchSubtasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(subtasksChannel);
    };
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

  // Detect @ and show user list
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    const match = value.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowUserList(true);
    } else {
      setShowUserList(false);
      setMentionQuery('');
    }
  };

  // Insert mention
  const handleUserMention = (user: User) => {
    if (!textareaRef.current) return;
    const value = newMessage;
    const newValue = value.replace(/@(\w*)$/, `@${user.first_name} ${user.last_name} `);
    setNewMessage(newValue);
    setShowUserList(false);
    setMentionQuery('');
    textareaRef.current.focus();
  };

  const statusConfig = {
    todo: { label: 'À faire', color: 'bg-gray-100 text-gray-800' },
    in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
    review: { label: 'À revoir', color: 'bg-yellow-100 text-yellow-800' },
    to_modify: { label: 'À modifier', color: 'bg-orange-100 text-orange-800' },
    completed: { label: 'Terminé', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' }
  };

  // Get assigned users from task_assignments table
  const [assignedUsers, setAssignedUsers] = useState<User[]>([]);
  
  useEffect(() => {
    fetchAssignedUsers();
  }, [task.id]);

  const fetchAssignedUsers = async () => {
    try {
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('user_id')
        .eq('task_id', task.id);

      if (assignments && assignments.length > 0) {
        const userIds = assignments.map(a => a.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds);

        const assignedUsersList = profiles?.map(profile => ({
          id: profile.user_id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email
        })) || [];

        setAssignedUsers(assignedUsersList);
      }
    } catch (error) {
      console.error('Error fetching assigned users:', error);
    }
  };
  const completedSubtasks = subtasks.filter(s => s.is_completed).length;

  if (loading) {
    console.log('TaskDetails is still loading...');
    return <div className="p-6">Chargement...</div>;
  }

  console.log('TaskDetails rendering with data:', { subtasks, messages, users });

  return (
    <div className="px-6 pb-6">
      <div className="flex flex-col lg:flex-row gap-6 h-[80vh]">
        {/* Partie gauche : détails */}
        <div className="flex-1 lg:w-[40%] bg-transparent space-y-6 overflow-y-auto rounded-xl p-1 h-full">
          {/* Header */}
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
              {assignedUsers.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Assigné à:</span>
                  <div className="text-sm">
                    {assignedUsers.map((user, idx) => (
                      <span key={user.id}>
                        {user.first_name} {user.last_name}
                        {idx < assignedUsers.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {task.start_date && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Date de début:</span>
                  <span className="text-sm">{new Date(task.start_date).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {task.end_date && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Date de fin:</span>
                  <span className="text-sm">{new Date(task.end_date).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Date d'échéance:</span>
                  <span className="text-sm">{new Date(task.due_date).toLocaleDateString('fr-FR')}</span>
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
        </div>

        {/* Partie droite : commentaires */}
        <div className="w-full lg:w-[60%] flex-shrink-0 space-y-6 overflow-y-auto rounded-xl p-1 h-full">
          {/* Dialog pour agrandir l'image */}
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="flex flex-col items-center justify-center">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="Aperçu"
                  className="max-h-[80vh] max-w-full rounded-xl border"
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Commentaires ({messages.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-[65vh]">
              {/* Liste des messages, scrollable */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {messages.map((message) => {
                  const isMine = user?.id === message.sender_id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMine && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-lg mr-2">
                          {message.profiles?.first_name?.[0]}
                          {message.profiles?.last_name?.[0]}
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] p-3 rounded-xl shadow ${
                          isMine
                            ? 'bg-blue-50 text-blue-900 border border-blue-200'
                            : 'bg-gray-50 text-gray-900 border border-border'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-sm">
                            {isMine ? 'Moi' : `${message.profiles?.first_name} ${message.profiles?.last_name}`}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(message.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap mb-2">{message.content}</div>
                        {message.file_url && message.file_name && (
                          <div className="mt-2">
                            {message.file_url.match(/\.(jpeg|jpg|png|gif|webp|bmp)$/i) ? (
                              <img
                                src={message.file_url}
                                alt={message.file_name}
                                className="max-w-xs rounded-md border cursor-pointer transition hover:scale-105"
                                onClick={() => setPreviewImage(message.file_url)}
                              />
                            ) : (
                              <a
                                href={message.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-primary hover:underline"
                              >
                                <Paperclip className="h-4 w-4 mr-1" />
                                {message.file_name}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      {isMine && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-lg ml-2">
                          {message.profiles?.first_name?.[0]}
                          {message.profiles?.last_name?.[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Separator className="my-3" />
              {/* Formulaire d'ajout, toujours visible en bas */}
              <div className="space-y-3 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ajouter un commentaire..."
                  value={newMessage}
                  onChange={handleCommentChange}
                  rows={3}
                />
                {/* Liste des utilisateurs pour la mention */}
                {showUserList && (
                  <div className="absolute z-10 bg-white border rounded shadow mt-1 w-64 max-h-60 overflow-y-auto">
                    {users
                      .filter(u =>
                        `${u.first_name} ${u.last_name}`.toLowerCase().includes(mentionQuery.toLowerCase())
                      )
                      .map(u => (
                        <div
                          key={u.id}
                          className="px-3 py-2 cursor-pointer hover:bg-blue-50"
                          onClick={() => handleUserMention(u)}
                        >
                          {u.first_name} {u.last_name} <span className="text-xs text-muted-foreground">({u.email})</span>
                        </div>
                      ))}
                    {users.filter(u =>
                      `${u.first_name} ${u.last_name}`.toLowerCase().includes(mentionQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-muted-foreground text-sm">Aucun utilisateur trouvé</div>
                    )}
                  </div>
                )}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}