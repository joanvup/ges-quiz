import { XMLParser } from 'fast-xml-parser';
import { prisma } from '@/lib/db';

export interface ResultadoImportacionMoodle {
  total: number;
  importadas: number;
  errores: string[];
  bancoNombre?: string;
}

export async function importarMoodleXml(
  xmlContent: string,
  userId: string,
  fileName?: string
): Promise<ResultadoImportacionMoodle> {
  const bancoNombre = fileName
    ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Banco Moodle';

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'question' || name === 'answer',
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlContent);
  } catch (err: any) {
    throw new Error(`XML inválido: ${err.message}`);
  }

  const quizNode = parsed?.quiz;
  if (!quizNode || !quizNode.question) {
    throw new Error('El archivo XML no contiene un elemento <quiz> con preguntas.');
  }

  const questions = Array.isArray(quizNode.question) ? quizNode.question : [quizNode.question];
  let importadas = 0;
  const errores: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const qType = q['@_type'];
      if (qType === 'category') continue;

      const statementRaw = q.questiontext?.text || q.questiontext || '';
      const statement = typeof statementRaw === 'string' ? statementRaw.trim() : JSON.stringify(statementRaw);
      if (!statement) {
        errores.push(`Pregunta ${i + 1}: Sin enunciado`);
        continue;
      }

      // Explicación / retroalimentación general
      const generalFeedbackRaw = q.generalfeedback?.text || q.generalfeedback || '';
      const explanation = typeof generalFeedbackRaw === 'string'
        ? generalFeedbackRaw.trim()
        : (generalFeedbackRaw?.text ? String(generalFeedbackRaw.text).trim() : null);

      let tipoDb = 'MCQ_SINGLE';
      if (qType === 'truefalse') {
        tipoDb = 'TRUE_FALSE';
      } else if (qType === 'shortanswer') {
        tipoDb = 'SHORT_ANSWER';
      } else if (qType === 'multichoice') {
        const single = q.single;
        if (single === false || single === 'false' || single === '0') {
          tipoDb = 'MCQ_MULTI';
        }
      }

      const rawAnswers = q.answer || [];
      const answersList = Array.isArray(rawAnswers) ? rawAnswers : [rawAnswers];

      const optionsData: { label: string; text: string; isCorrect: boolean; position: number }[] = [];
      const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      if (tipoDb === 'TRUE_FALSE') {
        let correctTrue = false;
        let correctFalse = false;
        for (const ans of answersList) {
          const frac = Number(ans['@_fraction'] ?? 0);
          const txt = String(ans.text || ans).trim().toLowerCase();
          if (frac > 0 && (txt === 'true' || txt === 'verdadero' || txt === '1')) correctTrue = true;
          if (frac > 0 && (txt === 'false' || txt === 'falso' || txt === '0')) correctFalse = true;
        }
        optionsData.push({ label: 'A', text: 'Verdadero', isCorrect: correctTrue, position: 1 });
        optionsData.push({ label: 'B', text: 'Falso', isCorrect: correctFalse, position: 2 });
      } else if (tipoDb === 'SHORT_ANSWER') {
        const correctText = answersList.find((a: any) => Number(a['@_fraction'] ?? 0) > 0)?.text || '';
        const ansText = typeof correctText === 'string' ? correctText.trim() : String(correctText);
        optionsData.push({ label: 'A', text: ansText, isCorrect: true, position: 1 });
      } else {
        let pos = 1;
        for (const ans of answersList) {
          if (pos > 8) break;
          const frac = Number(ans['@_fraction'] ?? 0);
          const ansTextRaw = ans.text || ans;
          const ansText = typeof ansTextRaw === 'string' ? ansTextRaw.trim() : String(ansTextRaw);
          if (!ansText) continue;
          optionsData.push({
            label: labels[pos - 1] || String(pos),
            text: ansText,
            isCorrect: frac > 0,
            position: pos,
          });
          pos++;
        }
      }

      if (optionsData.length === 0 && tipoDb !== 'SHORT_ANSWER') {
        errores.push(`Pregunta ${i + 1}: Sin opciones válidas`);
        continue;
      }

      const defaultGrade = Number(q.defaultgrade ?? 1);

      await prisma.question.create({
        data: {
          type: tipoDb,
          statement,
          explanation: explanation || null,
          topic: bancoNombre,
          points: Number.isNaN(defaultGrade) ? 1 : defaultGrade,
          status: 'APPROVED',
          origin: 'IMPORTED',
          authorId: userId,
          options: {
            create: optionsData,
          },
        },
      });

      importadas++;
    } catch (err: any) {
      errores.push(`Pregunta ${i + 1}: ${err.message}`);
    }
  }

  return {
    total: questions.length,
    importadas,
    errores,
    bancoNombre,
  };
}
