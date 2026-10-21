// E-mail único por execução do fluxo de cadastro (evita colisão entre runs).
env.EMAIL_E2E = 'e2e.' + Date.now() + '@example.com';
