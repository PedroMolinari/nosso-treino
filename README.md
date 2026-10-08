# 💪 Nosso Treino

Criei um aplicativo web para registrar atividades físicas com a minha namorada. Queríamos acompanhar nossos treinos juntos, ver nossa evolução e nos motivar um ao outro, sem transformar isso em competição.

Esse foi o meu primeiro aplicativo mobile: pensei a interface primeiro para o celular e depois adaptei para o computador.

Cada um entra com a própria conta, registra o que fez (academia, caminhada, corrida, dança...) e o app calcula as calorias estimadas, mostra o progresso das metas e junta tudo numa visão do casal.

## Telas
<!-- Coloque aqui os prints. Exemplo:
<img src="docs/dashboard.png" width="300" alt="Tela inicial">
<img src="docs/estatisticas.png" width="300" alt="Estatísticas">
-->

## O que dá para fazer
- **Início:** metas de alimentação do dia (calorias e proteínas), treino de hoje, resumo do casal e atividades recentes
- **Atividades:** registro rápido com calorias estimadas por MET, histórico com filtros e estatísticas em gráficos
- **Refeições:** calorias, proteínas, carboidratos e gorduras a partir de uma lista de alimentos editável (em gramas ou porções), com foto, visíveis para o casal (cada um edita só as próprias)
- **Torneio de 20 dias** entre o casal, com pontos, placar, histórico e as mesmas fotos das refeições
- **Perfil:** no cadastro, o app calcula automaticamente as metas de alimentação pelo GCT (fórmula de Mifflin-St Jeor); também reúne peso, conquistas e configurações
- Instalável na tela inicial do celular, com modo claro e escuro

## Como fiz
Quis manter tudo simples, então usei só HTML, CSS e JavaScript, sem framework e sem etapa de build. Os gráficos são do [Chart.js](https://www.chartjs.org/), o login e o banco de dados são do [Supabase](https://supabase.com/) e o site está publicado no [Netlify](https://www.netlify.com/).

Fiz em duas fases: primeiro a interface e a lógica inteiras com dados salvos no navegador, e depois troquei o armazenamento pelo Supabase, adicionando o login.

Fiz com ajuda do Claude, como professor e parceiro de programação, tentando entender cada parte do código.

## O que aprendi
Este projeto foi a primeira vez que usei o **Supabase** e o **Netlify**, e também a primeira vez que publiquei um site. Ver algo que eu criei funcionando no ar, no celular da minha namorada, foi muito legal.

## Como as calorias são calculadas
`calorias = MET × peso (kg) × duração (horas)`. O MET é um valor que indica o esforço de cada atividade. Ficam em `CONFIG.activities`, no arquivo `js/calories.js`, e são só estimativas.

## Estrutura
```
index.html           página única (navegação por #)
manifest.json        permite instalar na tela inicial do celular
icons/               ícone do app (casal de salsichas)
css/style.css        estilos, modo escuro, cores por perfil e layout responsivo
js/config.js         URL e chave pública do Supabase
js/calories.js       valores iniciais de atividades/METs e cálculo de calorias
js/storage.js        comunicação com o Supabase
js/stats.js          metas, sequência, gráficos e conquistas
js/tournament.js     torneio de 20 dias, pontuação e fotos das refeições
js/icons.js          ícones em SVG no lugar dos emojis
js/nutrition.js      aba Refeições (calorias, proteínas e carboidratos)
js/sync.js           fotos compartilhadas entre Torneio e Refeições
js/settings.js       configurações dentro do Perfil (torneio, atividades, alimentos)
js/app.js            telas, formulários e validação
supabase/            schema.sql, tournament.sql, rules.sql, profile.sql, settings.sql, wipe.sql, tournament-delete.sql, nutrition.sql, gct.sql, photo-sync.sql, shared-meals.sql
```

## Como rodar com o seu Supabase
1. Crie um projeto gratuito em supabase.com.
2. No **SQL Editor**, rode os arquivos de `supabase/`, nesta ordem: `schema.sql`, `tournament.sql`, `rules.sql`, `profile.sql`, `settings.sql`, `wipe.sql`, `tournament-delete.sql`, `nutrition.sql`, `gct.sql`, `photo-sync.sql`, `shared-meals.sql`.
3. Em **Authentication → Users**, crie os usuários (e-mail e senha) e desative o cadastro aberto.
4. Em `js/config.js`, coloque a Project URL e a chave publishable do seu projeto.
5. Abra o `index.html` ou publique a pasta em uma hospedagem estática, como Netlify ou GitHub Pages.

## Segurança
A chave publishable é pública por design e pode ficar no código. Nunca coloque a chave `secret` / `service_role` no repositório. Quem protege os dados é o login junto com o RLS: o casal vê as atividades um do outro, mas cada um só edita as próprias, e o histórico de peso é privado, e as refeições da aba Refeições são visíveis para o casal, mas só quem registrou pode editar.

## Personalização
- Atividades e METs, alimentos e pontos do torneio: Perfil → seções de configurações (valores iniciais em `CONFIG.activities`, `DEFAULT_FOODS` e `scoringRules`)
- Metas de alimentação: calculadas ao cadastrar e sempre que o perfil é salvo (`gct()` em `js/nutrition.js`)
- Novas conquistas: array `ACHIEVEMENTS` em `js/stats.js`
- Ícones: `js/icons.js`

## Próximas ideias
Lembretes de treino, mais estatísticas, integração com relógios e domínio próprio.
