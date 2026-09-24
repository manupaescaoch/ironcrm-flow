# EVO CLUB CRM

Quero criar um aplicativo completo de CRM para leads e aulas experimentais da IRON CLUB usando Supabase como backend.
Antes de gerar qualquer tela, me peça para informar:

SUPABASE_URL

SUPABASE_ANON_KEY

Depois que eu informar, conecte ao Supabase e:

Verifique se as tabelas leads e interacoes existem.

Se não existirem, execute automaticamente o SQL de criação.

Ative autenticação por e-mail/senha no app.

Crie as telas:

Login

Dashboard

CRM (lista de leads)

Detalhe do Lead

Funil Kanban (status_funil)

O campo plano_escolhido deve ter APENAS:

Executivo Mensal

Mensal

Trimestral

Semestral

Anual

Executivo Anual

Toda ação de apagar lead deve ser soft delete → ativo = false.

Após gerar a estrutura, me peça aprovação antes de finalizar.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ironcrm-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/62f1d776-4efc-466c-b52d-d908eb277eee).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
