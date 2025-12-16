-- Allow Comercial/Recepção to update confirmação/presença safely via triggers + permissive UPDATE policies

-- =====================
-- INTERACOES
-- =====================

-- 1) Trigger function to restrict what non-admin/non-owner can change
create or replace function public.enforce_interacoes_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin can change anything
  if public.has_role(auth.uid(), 'admin'::public.app_role) then
    return new;
  end if;

  -- Row owner can change anything (keeps current behavior for creators)
  if old.created_by = auth.uid() then
    return new;
  end if;

  -- Non-admin/non-owner: only allow operational fields
  if (new.confirmado is distinct from old.confirmado)
     or (new.compareceu is distinct from old.compareceu)
     or (new.descricao is distinct from old.descricao)
     or (new.reagendou is distinct from old.reagendou)
     or (new.data_experimental is distinct from old.data_experimental)
     or (new.hora_experimental is distinct from old.hora_experimental)
  then
    -- Ensure no other column changed
    if (new.agendou_experimental is distinct from old.agendou_experimental)
      or (new.atendido_por is distinct from old.atendido_por)
      or (new.atendido_por_tipo is distinct from old.atendido_por_tipo)
      or (new.cadastrado_por is distinct from old.cadastrado_por)
      or (new.comissao_cadastrador is distinct from old.comissao_cadastrador)
      or (new.comissao_comercial is distinct from old.comissao_comercial)
      or (new.comissao_recepcao is distinct from old.comissao_recepcao)
      or (new.created_at is distinct from old.created_at)
      or (new.created_by is distinct from old.created_by)
      or (new.data_fechamento is distinct from old.data_fechamento)
      or (new.data_interacao is distinct from old.data_interacao)
      or (new.fechou_matricula is distinct from old.fechou_matricula)
      or (new.id is distinct from old.id)
      or (new.lead_id is distinct from old.lead_id)
      or (new.origem_fechamento is distinct from old.origem_fechamento)
      or (new.plano_escolhido is distinct from old.plano_escolhido)
      or (new.quem_agendou is distinct from old.quem_agendou)
      or (new.quem_indicou is distinct from old.quem_indicou)
      or (new.responsavel_fechamento is distinct from old.responsavel_fechamento)
      or (new.tipo is distinct from old.tipo)
      or (new.tipo_atendimento is distinct from old.tipo_atendimento)
      or (new.treinador_experimental is distinct from old.treinador_experimental)
      or (new.treinador_responsavel is distinct from old.treinador_responsavel)
      or (new.valor_plano is distinct from old.valor_plano)
    then
      raise exception 'Operação não permitida: você só pode confirmar presença / marcar comparecimento / reagendar.';
    end if;

    return new;
  end if;

  -- If they didn't change any allowed field, or tried to change only disallowed fields
  raise exception 'Operação não permitida.';
end;
$$;

-- 2) Create trigger (idempotent)
drop trigger if exists trg_enforce_interacoes_update_permissions on public.interacoes;
create trigger trg_enforce_interacoes_update_permissions
before update on public.interacoes
for each row
execute function public.enforce_interacoes_update_permissions();

-- 3) Make UPDATE policy permissive for authenticated users (trigger will enforce what can change)
drop policy if exists update_own_interacoes_or_admin on public.interacoes;
create policy update_interacoes_authenticated
on public.interacoes
for update
to authenticated
using (true)
with check (true);


-- =====================
-- LEADS
-- (needed because marcar presença / follow-up changes lead fields)
-- =====================

create or replace function public.enforce_leads_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin can change anything
  if public.has_role(auth.uid(), 'admin'::public.app_role) then
    return new;
  end if;

  -- Owner can change anything (keeps existing behavior)
  if old.created_by = auth.uid() then
    return new;
  end if;

  -- Non-admin/non-owner: only allow follow-up operational updates
  -- Allowed:
  -- - follow_up_whatsapp_enviado / follow_up_enviado_em / follow_up_responsavel
  -- - status_funil (only to 'follow_up' or 'perdido')
  if (new.follow_up_whatsapp_enviado is distinct from old.follow_up_whatsapp_enviado)
     or (new.follow_up_enviado_em is distinct from old.follow_up_enviado_em)
     or (new.follow_up_responsavel is distinct from old.follow_up_responsavel)
     or (new.status_funil is distinct from old.status_funil)
  then
    if (new.status_funil is distinct from old.status_funil)
       and (new.status_funil not in ('follow_up','perdido'))
    then
      raise exception 'Operação não permitida: alteração de status não autorizada.';
    end if;

    -- Ensure no other column changed
    if (new.atendido_por is distinct from old.atendido_por)
      or (new.ativo is distinct from old.ativo)
      or (new.cadastrado_por is distinct from old.cadastrado_por)
      or (new.created_at is distinct from old.created_at)
      or (new.created_by is distinct from old.created_by)
      or (new.data_aula_experimental is distinct from old.data_aula_experimental)
      or (new.email is distinct from old.email)
      or (new.hora_aula_experimental is distinct from old.hora_aula_experimental)
      or (new.id is distinct from old.id)
      or (new.nome is distinct from old.nome)
      or (new.observacoes is distinct from old.observacoes)
      or (new.origem is distinct from old.origem)
      or (new.plano_escolhido is distinct from old.plano_escolhido)
      or (new.telefone is distinct from old.telefone)
      or (new.updated_at is distinct from old.updated_at)
      or (new.user_id is distinct from old.user_id)
    then
      raise exception 'Operação não permitida: você só pode atualizar informações de follow up.';
    end if;

    return new;
  end if;

  raise exception 'Operação não permitida.';
end;
$$;

-- Trigger
 drop trigger if exists trg_enforce_leads_update_permissions on public.leads;
create trigger trg_enforce_leads_update_permissions
before update on public.leads
for each row
execute function public.enforce_leads_update_permissions();

-- Make UPDATE policy permissive for authenticated users (trigger will enforce what can change)
drop policy if exists update_own_leads_or_admin on public.leads;
create policy update_leads_authenticated
on public.leads
for update
to authenticated
using (true)
with check (true);
