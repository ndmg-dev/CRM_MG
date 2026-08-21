# Seu CRM foi atualizado — v1.0.1 🎉🎉

Conteúdo de referência da release v1.0.1 (PR #30) — correções e ajustes de
notificações em cima da v1.0.0.

## Notificações e Mensagens

- **Som duplicado corrigido**: uma mensagem nova de chamado tocava dois
  avisos ao mesmo tempo (o do CRM + o "ding" nativo do navegador). Agora só
  toca um.
- **Notificação de comentário duplicada corrigida**: um trigger antigo no
  banco da Central de Suporte gerava um segundo aviso pro mesmo comentário,
  que vazava pro sino de Notificações em vez de ficar só em Mensagens.
- Novo botão **"Marcar tudo como lido"** no sino de Notificações (Mensagens já
  tinha).

## Chat Flutuante

- Ao chegar uma mensagem de chamado, o **chat abre automaticamente** — não
  precisa mais clicar na notificação.
- Novo botão de **minimizar**: o chat vira uma barrinha compacta no canto da
  tela em vez de fechar de vez.
