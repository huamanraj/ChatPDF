-- Create chats table
create table if not exists chats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references chats(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table chats enable row level security;
alter table messages enable row level security;

-- Create policies for chats
create policy "Users can view their own chats"
  on chats for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chats"
  on chats for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chats"
  on chats for update
  using (auth.uid() = user_id);

create policy "Users can delete their own chats"
  on chats for delete
  using (auth.uid() = user_id);

-- Create policies for messages
create policy "Users can view messages in their chats"
  on messages for select
  using (
    exists (
      select 1 from chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their chats"
  on messages for insert
  with check (
    exists (
      select 1 from chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );


-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to track uploaded files
create table if not exists chat_files (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references chats(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_size bigint not null,
  file_type text not null,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for chat_files
alter table chat_files enable row level security;

-- Create policies for chat_files
create policy "Users can view files in their chats"
  on chat_files for select
  using (
    exists (
      select 1 from chats
      where chats.id = chat_files.chat_id
      and chats.user_id = auth.uid()
    )
  );

create policy "Users can insert files in their chats"
  on chat_files for insert
  with check (
    exists (
      select 1 from chats
      where chats.id = chat_files.chat_id
      and chats.user_id = auth.uid()
    )
  );

-- Create a table to store your documents
create table if not exists documents (
  id bigserial primary key,
  content text, -- corresponds to Document.pageContent
  metadata jsonb, -- corresponds to Document.metadata
  embedding vector(1536), -- 1536 works for OpenAI embeddings, change if needed
  chat_id uuid not null, -- to associate documents with a specific chat
  file_name text -- to track which file this chunk came from
);

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_chat_id uuid
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
) language plpgsql stable as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  and documents.chat_id = filter_chat_id
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
