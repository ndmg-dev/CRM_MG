"""Integração do CRM com o motor de apuração de ICMS das saídas (repo tnunes8/motor-calculos).

O backend do CRM é o único que fala com o motor: autentica a pessoa (JWT do CRM), confere a permissão por ação e repassa a chamada
com X-API-Key (segredo do servidor) e X-Actor (e-mail do usuário), numa LISTA FECHADA de rotas. Portado do BFF do painel provisório.
"""
