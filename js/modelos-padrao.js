/*
 * Modelos de resposta padrão carregados na primeira utilização.
 * Podem ser editados livremente pela interface (aba "Respostas padrão").
 * Para restaurar estes textos: Configurações > "Restaurar modelos padrão".
 */
window.MODELOS_PADRAO = [
  {
    titulo: 'Diligência cumprida (genérica)',
    categoria: 'Cumprimento',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em atenção à requisição constante dos autos em epígrafe ({{tipo}}), vem respeitosamente INFORMAR a Vossa Excelência que a diligência determinada foi devidamente cumprida por esta Unidade Policial, conforme documentação em anexo.

Permaneço à disposição para quaisquer esclarecimentos adicionais.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Juntada de laudo pericial',
    categoria: 'Laudos e perícias',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em cumprimento ao determinado nos autos em epígrafe, vem respeitosamente REQUERER A JUNTADA do(s) laudo(s) pericial(is) em anexo, a saber:

- Laudo nº ______ – ______________________________ (tipo de exame).

Informo, ainda, que não há outras perícias pendentes relacionadas a este procedimento. [Ajustar, se for o caso.]

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Laudo pendente – aguardando órgão pericial',
    categoria: 'Laudos e perícias',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em atenção à requisição de juntada de laudo pericial nos autos em epígrafe, vem respeitosamente INFORMAR a Vossa Excelência que o exame foi requisitado ao órgão pericial competente em ____/____/______ (ofício/requisição nº ______), encontrando-se o respectivo laudo pendente de conclusão.

Esta Unidade Policial reiterou a solicitação e procederá à juntada tão logo o laudo seja disponibilizado, razão pela qual solicita a concessão de prazo suplementar de ______ dias.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Intimação cumprida',
    categoria: 'Intimações',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em cumprimento ao determinado nos autos em epígrafe, vem respeitosamente INFORMAR a Vossa Excelência que foi realizada a intimação de ______________________________ em ____/____/______, conforme certidão/termo de intimação em anexo.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Intimação frustrada – pessoa não localizada',
    categoria: 'Intimações',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em atenção à determinação de intimação nos autos em epígrafe, vem respeitosamente INFORMAR a Vossa Excelência que, apesar das diligências empreendidas por esta Unidade Policial, NÃO FOI POSSÍVEL LOCALIZAR ______________________________ no endereço constante dos autos (__________________________________________).

Diligências realizadas:
- ____/____/______: comparecimento ao endereço informado – ______________________;
- ____/____/______: tentativa de contato telefônico/consulta aos sistemas – ______________________.

Segue em anexo a certidão da equipe responsável. Coloco-me à disposição para cumprimento de nova diligência, caso seja informado endereço atualizado.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Pedido de dilação de prazo (inquérito)',
    categoria: 'Prazos',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, nos autos em epígrafe, vem respeitosamente REQUERER a Vossa Excelência a DILAÇÃO DO PRAZO por mais ______ dias para conclusão das diligências, com fundamento no art. 10, § 3º, do Código de Processo Penal.

O pedido se justifica pela necessidade de cumprimento das seguintes diligências ainda pendentes:
1. ________________________________________________;
2. ________________________________________________;
3. ________________________________________________.

Ressalto que as diligências já realizadas constam dos autos e que as pendentes são imprescindíveis ao esclarecimento dos fatos.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Pedido de prazo suplementar para diligência específica',
    categoria: 'Prazos',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em atenção à requisição de {{tipo}} constante dos autos em epígrafe, vem respeitosamente INFORMAR que a diligência encontra-se em andamento e SOLICITAR a concessão de prazo suplementar de ______ dias para o seu integral cumprimento.

Justificativa: ________________________________________________ (ex.: necessidade de deslocamento da equipe, aguardo de resposta de órgão externo, demanda elevada da unidade).

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Informação de diligências em andamento',
    categoria: 'Informações',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em atenção ao despacho constante dos autos em epígrafe, vem respeitosamente INFORMAR a Vossa Excelência o andamento das diligências:

Diligências já realizadas:
- ________________________________________________;
- ________________________________________________.

Diligências em curso:
- ________________________________________________.

Tão logo concluídas, os autos serão remetidos com o respectivo relatório.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Oitiva realizada – juntada de termo',
    categoria: 'Cumprimento',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em cumprimento à diligência requisitada nos autos em epígrafe, vem respeitosamente REQUERER A JUNTADA do termo de declarações/depoimento de ______________________________, colhido em ____/____/______, em anexo.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Diligência já cumprida anteriormente',
    categoria: 'Informações',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, em atenção à requisição constante dos autos em epígrafe, vem respeitosamente INFORMAR a Vossa Excelência que a diligência solicitada já foi cumprida e juntada aos autos em ____/____/______ (ID nº {{id_pje}}), não havendo providência pendente por parte desta Unidade Policial quanto a este ponto.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Remessa de relatório final',
    categoria: 'Conclusão',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, vem respeitosamente encaminhar a Vossa Excelência o RELATÓRIO FINAL do procedimento policial em epígrafe, concluído nos termos do art. 10, § 1º, do Código de Processo Penal, acompanhado dos documentos que o instruem.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  },
  {
    titulo: 'Ciência de decisão / despacho',
    categoria: 'Informações',
    texto:
`Excelentíssimo(a) Senhor(a) {{autoridade}}
{{orgao}}

Processo nº {{processo}}
Procedimento policial: {{inquerito}}

{{cargo}} titular da {{delegacia}}, vem respeitosamente manifestar CIÊNCIA da decisão/despacho proferido nos autos em epígrafe, informando que serão adotadas as providências cabíveis por esta Unidade Policial.

{{cidade}}, {{data_extenso}}.

{{delegado}}
{{cargo}}`
  }
];
