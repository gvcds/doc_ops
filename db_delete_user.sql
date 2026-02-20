-- Função para permitir que um administrador exclua um usuário do auth.users
-- Isso é necessário porque o cliente Supabase JS não pode excluir usuários do Auth diretamente sem a service_role key.
-- Ao usar SECURITY DEFINER, a função roda com permissões de superusuário no banco.

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requester_perfil TEXT;
BEGIN
  -- 1. Verificar se quem está chamando a função é um administrador
  -- Buscamos o perfil do usuário logado (auth.uid()) na tabela public.profiles
  SELECT perfil INTO requester_perfil 
  FROM public.profiles 
  WHERE id = auth.uid();

  IF requester_perfil != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários.';
  END IF;

  -- 2. Não permitir que o admin exclua a si mesmo (opcional, mas recomendado para segurança)
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Ação inválida: você não pode excluir sua própria conta por aqui.';
  END IF;

  -- 3. Excluir do auth.users
  -- O Supabase cuida de deletar em cascata as tabelas auth.identities e etc.
  -- Também deletará o perfil em public.profiles se houver uma FK com ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = target_user_id;

  -- 4. Garantir que o perfil foi removido (caso não haja cascade na FK)
  DELETE FROM public.profiles WHERE id = target_user_id;

END;
$$;
