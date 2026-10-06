# Testing Playbook — Auth (JWT custom + Emergent Google Auth)

Dois provedores coexistem:
1. JWT custom (cookies `access_token`/`refresh_token`) — cadastro com WhatsApp/senha e admin por e-mail.
2. Emergent Google Auth (cookie `session_token`, coleção `user_sessions`, usuários com `user_id` próprio).

## Teste do Google Auth (sem conta Google real)

### Passo 1: criar usuário e sessão de teste
```bash
mongosh --eval "
use('test_database');
var userId = 'user_test' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  full_name: 'Test User Google',
  role: 'member',
  auth_provider: 'google',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

### Passo 2: testar API
```bash
curl -X GET "https://<app>/api/auth/me" -H "Authorization: Bearer <SESSION_TOKEN>"
curl -X PUT "https://<app>/api/auth/profile" -H "Authorization: Bearer <SESSION_TOKEN)" \
  -H "Content-Type: application/json" -d '{"birth_date":"1990-05-20","whatsapp":"11987654321"}'
curl -X GET "https://<app>/api/hymns/week" -H "Authorization: Bearer <SESSION_TOKEN>"
```

### Passo 3: teste no navegador (Playwright)
```python
await page.context.add_cookies([{
    "name": "session_token", "value": "<SESSION_TOKEN>",
    "domain": "<app-domain>", "path": "/",
    "httpOnly": True, "secure": True, "sameSite": "None"
}])
await page.goto("https://<app>/portal")
```

## Fluxo real do Google Auth
1. Botão "Continuar com Google" em /acesso → `https://auth.emergentagent.com/?redirect=<origin>/portal` (NUNCA hardcodar o redirect; sempre `window.location.origin`).
2. Retorno em `/portal#session_id=...` → AppRouter detecta o hash sincronamente e renderiza AuthCallback.
3. AuthCallback chama POST /api/auth/google/session → backend valida com Emergent (`X-Session-ID`), cria/atualiza usuário, grava `user_sessions` e define cookie `session_token` (7 dias).
4. Usuário Google novo (sem whatsapp/birth_date) vê a tela "Complete seu cadastro" no portal (PUT /api/auth/profile).

## Limpeza
```bash
mongosh --eval "
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
"
```

## Checklist
- /api/auth/me retorna usuário via cookie `session_token` e via Bearer
- JWT custom (admin/login WhatsApp) continua funcionando
- Usuário Google sem perfil completo vê CompleteProfile; após PUT /profile acessa o portal
- Detecção do callback usa `useLocation().hash` (reativo), nunca `window.location.hash` nas rotas
