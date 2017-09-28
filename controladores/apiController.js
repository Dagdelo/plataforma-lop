const mongoose = require("mongoose");
const Questao = mongoose.model("Questao");
const Submissao = mongoose.model("Submissao");
const SubmissaoProva = mongoose.model("SubmissaoProva");
const Rascunho = mongoose.model("Rascunho");
const Data = mongoose.model("Data");
const executar = require("../negocio/executar");

/**
 * Incrementa o contador de execuções no banco de forma atômica
 */
exports.incrementarExecucoes = (req, res, next) => {
  Data.findOneAndUpdate(
    {},
    {
      $inc: { exec: 1 }
    },
    {
      upsert: true
    },
    function (err, data) {
      if (err) {
        console.log("Erro ao salvar execução no banco");
        throw err;
      }
    }
  );
  next();
};

exports.incrementarCliqueNovidades = (req, res) => {
  Data.findOneAndUpdate({},
    {
      $inc: { 'cliqueNovidades': 1 }
    }, {
      upsert: true
    },
    function (err, data) {
      if (err) {
        console.error("Erro ao incrementar clique em novidades");
        throw err;
      }
    });
};

/**
 * Execução de código em que os resultados esperados vem na requisição
 * Utilizado na execução presente no cadastro de questões
 */
exports.executarCodigoComResultado = (req, res) => {
  const { codigo, resultadosEsperados } = req.body;
  if (
    !resultadosEsperados ||
    !resultadosEsperados[0] ||
    !resultadosEsperados[0].saida
  ) {
    res.status(500).send("Resultados esperados vieram nulos");
    return;
  }

  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entrada: resultadosEsperados[i].entradas.join(" "),
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  res.json(resultados);
};

/**
 * Execução de código em que os resultados são extraídos de uma questão específica
 * Utilizado no editor de código da página de questões do sistema
 */
exports.executarCodigoQuestao = async (req, res) => {
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  if (!questao) {
    res.status(500).send("Nenhuma questão encontrada para o id informado");
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entrada: `[${resultadosEsperados[i].entradas.join(", ")}]`,
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  res.json(resultados);
};

/**
 * Execução de código de questão de uma prova. Semelhante a execução de uma questão normal
 * entretanto só retorna um caso de teste para o usuário
 */
exports.executarCodigoQuestaoProva = async (req, res) => {
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  if (!questao) {
    res.status(500).send("Nenhuma questão encontrada para o id informado");
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < 1; i++) {
    resultados.push({
      entrada: `[${resultadosEsperados[i].entradas.join(", ")}]`,
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  res.json(resultados);
};

exports.submeterCodigoQuestao = async (req, res) => {
  if (!req.user) {
    res.status(500).send("Você precisa estar logado para submeter questões");
    return;
  }
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  if (!questao) {
    res.status(500).send("Nenhum questão encontrada para o id informado.");
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entradas: resultadosEsperados[i].entradas.join(" "),
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  let acertos = 0;
  resultados.forEach(res => {
    if (res.saida === res.saidaEsperada) {
      acertos++;
    }
  });

  const porcentagemAcerto = Math.trunc(acertos * 100 / resultados.length);

  const submissao = new Submissao({
    codigo,
    questao: questao._id,
    resultados,
    porcentagemAcerto,
    user: req.user
  });

  await submissao.save();
  res.json(submissao);
};

exports.submeterCodigoQuestaoProva = async (req, res) => {
  if (!req.user) {
    res.status(500).send("Você precisa estar logado para submeter questões");
    return;
  }
  const { codigo, questaoId, provaId } = req.body;
  const questao = await Questao.findOne({ _id: questaoId });
  if (!questao) {
    res.status(500).send("Nenhum questão encontrada para o id informado.");
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entradas: resultadosEsperados[i].entradas.join(" "),
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  let acertos = 0;
  resultados.forEach(res => {
    if (res.saida === res.saidaEsperada) {
      acertos++;
    }
  });

  const porcentagemAcerto = Math.trunc(acertos * 100 / resultados.length);

  const submissaoProva = new SubmissaoProva({
    codigo,
    questao: questao._id,
    resultados,
    porcentagemAcerto,
    user: req.user,
    prova: provaId
  });

  console.log(`Aluno "${req.user.nome}" de matrícula "${req.user.matricula}" submeteu a questão "${questao.titulo}" e obteve ${porcentagemAcerto}% de acerto.`);

  await submissaoProva.save();
  res.json('Questão submetida com sucesso');
};

exports.getTags = async (req, res) => {
  const tags = await Questao.find().distinct("tags");
  res.json(tags);
};

exports.getQuestoes = async (req, res) => {
  const questoes = await Questao.find();
  res.json(questoes);
};

exports.salvarRascunho = async (req, res) => {
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  const data = Date.now();

  const rascunho = {
    questao,
    codigo,
    user: req.user,
    data
  };

  const rascunhoSalvo = await Rascunho.findOneAndUpdate({ questao, user: req.user }, rascunho, {
    new: true, upsert: true
  }).exec();
  res.json(rascunhoSalvo);
};