import { supabase } from '@/integrations/supabase/client';

// Son de notification simple avec Web Audio API
export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Créer un oscillateur pour générer un son
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Configuration du son
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Fréquence de 800Hz
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1); // Descendre à 600Hz
    
    // Configuration du volume
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    // Connecter les nœuds
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Jouer le son
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log('Notification sound not supported:', error);
  }
};

export interface NotificationData {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  related_type?: string;
  related_id?: string;
}

export const createNotification = async (data: NotificationData) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: data.user_id,
        title: data.title,
        message: data.message,
        type: data.type || 'assignment',
        related_type: data.related_type || 'task',
        related_id: data.related_id,
        read: false
      });

    if (error) throw error;
    console.log('Notification créée avec succès');
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
  }
};

export const createTaskAssignmentNotifications = async (taskId: string, taskTitle: string, assignedUserIds: string[]) => {
  try {
    const notifications = assignedUserIds.map(userId => ({
      user_id: userId,
      title: '📋 Nouvelle assignation de tâche',
      message: `Vous avez été assigné(e) à la tâche : "${taskTitle}"`,
      type: 'assignment',
      related_type: 'task',
      related_id: taskId
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;
    
    console.log(`${notifications.length} notifications d'assignation créées`);
  } catch (error) {
    console.error('Erreur lors de la création des notifications d\'assignation:', error);
  }
};