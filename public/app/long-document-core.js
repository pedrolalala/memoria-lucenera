(function (root) {
  const DEFAULTS = Object.freeze({ minWords: 1200, targetWords: 2200, maxWords: 3000, overlapWords: 120 });

  const normalize = value => String(value || '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const words = value => normalize(value).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
  const wordCount = value => words(value).length;

  function paragraphsFromText(text) {
    const clean = normalize(text);
    if (!clean) return [];
    const blocks = clean.split(/\n\s*\n+/).map(item => item.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    if (blocks.length > 1) return blocks;
    return clean.split(/\n+/).map(item => item.trim()).filter(Boolean);
  }

  function isHeading(text) {
    const value = normalize(text);
    if (!value || value.length > 150 || wordCount(value) > 18 || /^\d+[\s./-]*$/.test(value) || /^[IVXLCDM]+[.)]?$/i.test(value)) return false;
    if (/^(?:[IVXLCDM]{1,7}[.)]|\d+(?:\.\d+){1,4}|\d+[.)])\s+\S+/i.test(value)) return true;
    if (/^(?:introdu(?:ção|zione|ction)|premessa|prefácio|preface|conclus(?:ão|ões|ioni|ion)|bibliografia|bibliography|referências|indice|índice|sumário|appendice|apêndice)\b/i.test(value)) return true;
    const letters = value.replace(/[^\p{L}]/gu, '');
    return letters.length >= 5 && value === value.toUpperCase();
  }

  function tailWords(text, count) {
    const list = words(text);
    return list.slice(Math.max(0, list.length - count)).join(' ');
  }

  function sectionTitle(paragraphs, index) {
    const candidates = paragraphs.filter(isHeading).map((text, order) => {
      const value = normalize(text);
      const rank = /^(?:[IVXLCDM]{1,7}[.)]|\d+(?:\.\d+){1,4}|\d+[.)])\s+\S+/i.test(value) ? 3
        : /^(?:introdu(?:ção|zione|ction)|premessa|prefácio|preface|conclus(?:ão|ões|ioni|ion)|bibliografia|bibliography|referências|indice|índice|sumário|appendice|apêndice)\b/i.test(value) ? 2 : 1;
      return { text, order, rank };
    }).sort((a, b) => b.rank - a.rank || a.order - b.order);
    const heading = candidates[0]?.text;
    if (heading) return heading.replace(/\s+/g, ' ').trim();
    return `Parte ${index + 1}`;
  }

  function likelyTableOfContents(paragraphs) {
    const headingCount = paragraphs.filter(isHeading).length;
    const average = paragraphs.length ? paragraphs.reduce((sum, item) => sum + wordCount(item), 0) / paragraphs.length : 0;
    return headingCount >= 6 && average < 16;
  }

  function withoutTableOfContents(paragraphs) {
    const start = paragraphs.findIndex(item => /^(?:índice|indice|sumário|contents?)$/i.test(normalize(item)));
    if (start < 0) return paragraphs;
    let candidateCount = 0;
    for (let index = start + 1; index < paragraphs.length - 1; index++) {
      if (isHeading(paragraphs[index])) candidateCount += 1;
      const next = paragraphs.slice(index + 1, index + 4);
      if (candidateCount >= 6 && isHeading(paragraphs[index]) && next.some(item => wordCount(item) >= 70)) {
        return [...paragraphs.slice(0, start), ...paragraphs.slice(index)];
      }
    }
    return paragraphs;
  }

  function splitLongText(text, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const paragraphs = withoutTableOfContents(paragraphsFromText(text)).flatMap(paragraph => {
      if (wordCount(paragraph) <= settings.maxWords) return [paragraph];
      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
      const pieces = [];
      let current = '';
      sentences.forEach(sentence => {
        if (current && wordCount(`${current} ${sentence}`) > settings.maxWords) {
          pieces.push(current.trim());
          current = sentence;
        } else current = `${current} ${sentence}`.trim();
      });
      if (current) pieces.push(current.trim());
      return pieces;
    });
    const sections = [];
    let buffer = [];
    let bufferWords = 0;
    let contextBefore = '';

    const flush = () => {
      if (!buffer.length) return;
      const content = buffer.join('\n\n').trim();
      const index = sections.length;
      sections.push({
        index,
        title: sectionTitle(buffer, index),
        locator: sectionTitle(buffer, index),
        content,
        contextBefore,
        wordCount: wordCount(content),
        include: !likelyTableOfContents(buffer),
        likelyTableOfContents: likelyTableOfContents(buffer),
      });
      contextBefore = tailWords(content, settings.overlapWords);
      buffer = [];
      bufferWords = 0;
    };

    paragraphs.forEach(paragraph => {
      const count = wordCount(paragraph);
      const heading = isHeading(paragraph);
      if (heading && bufferWords >= settings.minWords) flush();
      if (!heading && bufferWords > 0 && bufferWords + count > settings.maxWords) flush();
      buffer.push(paragraph);
      bufferWords += count;
      if (bufferWords >= settings.targetWords && !heading) flush();
    });
    flush();

    if (sections.length > 1 && sections.at(-1).wordCount < Math.floor(settings.minWords * 0.45)) {
      const last = sections.pop();
      const previous = sections.at(-1);
      previous.content = `${previous.content}\n\n${last.content}`;
      previous.wordCount = wordCount(previous.content);
    }
    let previousTitle = '';
    return sections.map((section, index) => {
      let title = section.title;
      if (/^Parte \d+$/.test(title) && previousTitle) title = `${previousTitle.replace(/ — continuação(?: \d+)?$/,'')} — continuação`;
      else previousTitle = title;
      return { ...section, title, locator:title, index };
    });
  }

  root.LongDocumentCore = Object.freeze({ DEFAULTS, normalize, wordCount, paragraphsFromText, isHeading, likelyTableOfContents, withoutTableOfContents, splitLongText });
})(typeof globalThis !== 'undefined' ? globalThis : window);
