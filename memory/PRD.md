# PRD — Banda El Shaday | Portal de Louvor

## Problema original (declaração do usuário)
"Crie um site particular para uma banda de som gospel, que tem por nome banda el shaday, neste site os componentes da banda terá acesso, neste site terá os hinos da semana também terá uma play list de hinos, terá data de aniversário dos componentes, o cadastro será com nome completo data de aniversário e WhatsApp, vou lhe manda a logo da banda use as mesmas paletas de cores e fonte."

## Decisões do usuário
- Logo oficial enviada (vinho #801C1C, dourado #D8AA5F, creme; fonte manuscrita) — aplicada em todo o site e usada como favicon
- Acesso: cadastro próprio com nome completo, data de aniversário, WhatsApp + senha (JWT, cookies httpOnly)
- Playlist: YouTube embutido + links Spotify
- Hinos da semana: somente o administrador define; integrantes visualizam

## Personas
- Administrador (dono/líder da banda): gerencia hinos da semana, repertório e vê integrantes
- Integrante: acessa hinos da semana, playlist e aniversários

## Arquitetura
- Frontend: React 19 + Tailwind + framer-motion + lenis (landing pública, /acesso, /portal protegido)
- Backend: FastAPI + MongoDB (motor), auth JWT em cookies httpOnly com refresh, proteção contra força bruta (5 tentativas → 15 min)
- Coleções: users (whatsapp/email únicos), hymns, login_attempts
- Seeds: 8 hinos gospel reais (5 com embed YouTube validado via oEmbed), admin semeado apenas se ausente

## Implementado (02/10/2026)
- Landing page imersiva (hero com reveal mascarado, parallax, marquee editorial, bento grid, destaques públicos, sobre + Salmos 150)
- Cadastro/login com WhatsApp mascarado (BR) ou e-mail (admin)
- Login social com Google (Emergent-managed OAuth): botão "Continuar com Google", callback com session_id, sessões de 7 dias em user_sessions, coexistindo com o JWT por senha
- Novos usuários Google preenchem aniversário + WhatsApp na tela "Complete seu cadastro" (PUT /api/auth/profile) antes de acessar o portal
- Portal: Hinos da Semana (player YouTube, tom, tags, letra), Playlist (busca + filtros por tag, cards com play inline), Avisos & Agenda (categorias Agenda/Congresso/Aviso, aviso em destaque vira banner "Aviso importante" no topo do portal), Aniversariantes (hoje/mês/próximos + botão WhatsApp de parabéns), Administração (lista de integrantes)
- Gerenciamento distribuído por aba para o admin: botões de adicionar, editar (dialog pré-preenchido), excluir e destacar/estrela dentro de Hinos da Semana, Playlist e Avisos; integrantes (adicionar com senha inicial, editar, remover) são gerenciados na aba Aniversariantes; aba Administração removida
- Aba Mídia: galeria de fotos e vídeos da banda com upload pelo admin (object storage Emergent, até 100 MB), filtros Fotos/Vídeos, lightbox para fotos, player de vídeo inline, soft-delete; arquivos servidos via backend com cookie de sessão
- Landing pública exibe a seção "Avisos & agenda" com os 3 avisos mais recentes
- Verificado: registro, login admin, cookies, 401/403, CRUD de hinos e avisos, sessão Google simulada (mongosh + cookie), completar perfil, logout; screenshots desktop/mobile

## Backlog priorizado
- P0: (nenhum pendente do pedido original)
- P1: Escala de culto com funções (vocal, teclado...), aviso automático de aniversário via WhatsApp
- P2: Cifras em PDF por hino, presença/confirmação de ensaio, notificações no portal, upload de fotos da banda

## Credenciais
Ver /app/memory/test_credentials.md (admin: admin@elshaday.com / ElShaday@2026; integrante teste: WhatsApp 11999990001 / teste123)
