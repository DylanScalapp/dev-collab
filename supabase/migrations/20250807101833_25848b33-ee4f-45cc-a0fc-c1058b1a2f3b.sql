-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('developer', 'admin');

-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'to_modify', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role user_role DEFAULT 'developer',
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create project_members table (many-to-many)
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_leader BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    assigned_to UUID REFERENCES auth.users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create task_assignments table (many-to-many for multiple developers)
CREATE TABLE public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_leader BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(task_id, user_id)
);

-- Create subtasks table
CREATE TABLE public.subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create messages table for project/task communication
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    mentioned_users UUID[],
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = _role AND is_approved = true
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Create function to check if user can access project
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.profiles p ON p.user_id = pm.user_id
    WHERE pm.project_id = _project_id 
    AND pm.user_id = _user_id 
    AND p.is_approved = true
  ) OR public.is_admin(_user_id)
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view approved profiles" ON public.profiles
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for projects
CREATE POLICY "Users can view accessible projects" ON public.projects
    FOR SELECT USING (public.can_access_project(auth.uid(), id));

CREATE POLICY "Admins can manage projects" ON public.projects
    FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for project_members
CREATE POLICY "Users can view project members for accessible projects" ON public.project_members
    FOR SELECT USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Admins can manage project members" ON public.project_members
    FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks in accessible projects" ON public.tasks
    FOR SELECT USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Admins can manage tasks" ON public.tasks
    FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for task_assignments
CREATE POLICY "Users can view task assignments for accessible projects" ON public.task_assignments
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.tasks t 
        WHERE t.id = task_id AND public.can_access_project(auth.uid(), t.project_id)
    ));

CREATE POLICY "Admins can manage task assignments" ON public.task_assignments
    FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for subtasks
CREATE POLICY "Users can view subtasks for accessible tasks" ON public.subtasks
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.tasks t 
        WHERE t.id = task_id AND public.can_access_project(auth.uid(), t.project_id)
    ));

CREATE POLICY "Users can update subtasks they created or are assigned to" ON public.subtasks
    FOR UPDATE USING (
        created_by = auth.uid() OR EXISTS (
            SELECT 1 FROM public.task_assignments ta
            JOIN public.tasks t ON t.id = ta.task_id
            WHERE ta.task_id = task_id AND ta.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage subtasks" ON public.subtasks
    FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for messages
CREATE POLICY "Users can view messages in accessible projects/tasks" ON public.messages
    FOR SELECT USING (
        (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id)) OR
        (task_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tasks t 
            WHERE t.id = task_id AND public.can_access_project(auth.uid(), t.project_id)
        ))
    );

CREATE POLICY "Users can create messages in accessible projects/tasks" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND (
            (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id)) OR
            (task_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.tasks t 
                WHERE t.id = task_id AND public.can_access_project(auth.uid(), t.project_id)
            ))
        )
    );

-- Storage policies
CREATE POLICY "Users can upload files in accessible projects" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'project-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view files in accessible projects" ON storage.objects
    FOR SELECT USING (bucket_id = 'project-files');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'developer'::user_role,
    false  -- Requires admin approval
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create update triggers for timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON public.subtasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create first admin user (you'll need to update this with actual admin email)
-- This will be done after user signs up manually