# APK Android: correções e salvamento do perfil

- Fonte: `5f66f54438b6a25e30e8b1b8307f3fbcc1baab3c`.
- Build: `e79cfe64-9a93-4c6e-8059-eb47aa0c3b3c`.
- Painel: https://expo.dev/accounts/codaxi/projects/petlive-tutor/builds/e79cfe64-9a93-4c6e-8059-eb47aa0c3b3c
- Perfil/canal: preview, Android APK, `app.petlive.tutor`.
- Runtime: `2f48ad7475375d8681d4d351319e7c210a1993cf`.
- Resultado confirmado: `FINISHED`, sem erro reportado pelo EAS, fonte `5f66f54`.
- APK: https://expo.dev/artifacts/eas/s6m9E_nl1xO9n1TacvwY9GhO1mDKJEQSrdKWnNlX1l4.apk
- OTA do mesmo código: grupo `29ec4366-a9b2-4e55-8f8a-75b31935c0cd`, update `01a17453-490f-76cd-8ac3-b8582254e0b9`, preview, Android.

Inclui nome com espaço para descendentes, avatar sem margem negativa no ScrollView, tratamento de falhas ao selecionar foto, perfil com erro e nova tentativa na leitura e confirmação de que o registro foi alterado ao salvar dados/foto/remover avatar. Inclui Minha assinatura para consulta, sem compra ou gestão de cobrança. Storage de foto já reparado em produção, privado e isolado por tutor.

Validação: 333 testes, TypeScript e lint passaram. Bundle Android exportado e OTA publicada com o runtime calculado, sem forçar compatibilidade. Teste final do layout e upload no Android permanece pendente. Não desinstalar a versão anterior para atualizar o app e preservar os dados locais.
