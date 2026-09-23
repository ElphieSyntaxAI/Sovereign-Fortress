-- Per-project model routing. Empty project_origin is the tenant default.

alter table public.msgf_tenant_consensus_config
  add column if not exists project_origin text;

update public.msgf_tenant_consensus_config
  set project_origin = ''
  where project_origin is null;

alter table public.msgf_tenant_consensus_config
  alter column project_origin set default '';

alter table public.msgf_tenant_consensus_config
  alter column project_origin set not null;

alter table public.msgf_tenant_consensus_config
  drop constraint if exists msgf_tenant_consensus_config_pkey;

alter table public.msgf_tenant_consensus_config
  add constraint msgf_tenant_consensus_config_pkey
  primary key (tenant_id, project_origin);

comment on column public.msgf_tenant_consensus_config.project_origin is
  'Project origin for this routing preset. Empty string is the tenant default.';
