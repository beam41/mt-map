import { readFileSync, writeFileSync } from 'fs';
import { load } from 'cheerio';

const HTMLElementTagNameMap = {
  a: 'HTMLAnchorElement',
  abbr: 'HTMLElement',
  address: 'HTMLElement',
  area: 'HTMLAreaElement',
  article: 'HTMLElement',
  aside: 'HTMLElement',
  audio: 'HTMLAudioElement',
  b: 'HTMLElement',
  base: 'HTMLBaseElement',
  bdi: 'HTMLElement',
  bdo: 'HTMLElement',
  blockquote: 'HTMLQuoteElement',
  body: 'HTMLBodyElement',
  br: 'HTMLBRElement',
  button: 'HTMLButtonElement',
  canvas: 'HTMLCanvasElement',
  caption: 'HTMLTableCaptionElement',
  cite: 'HTMLElement',
  code: 'HTMLElement',
  col: 'HTMLTableColElement',
  colgroup: 'HTMLTableColElement',
  data: 'HTMLDataElement',
  datalist: 'HTMLDataListElement',
  dd: 'HTMLElement',
  del: 'HTMLModElement',
  details: 'HTMLDetailsElement',
  dfn: 'HTMLElement',
  dialog: 'HTMLDialogElement',
  div: 'HTMLDivElement',
  dl: 'HTMLDListElement',
  dt: 'HTMLElement',
  em: 'HTMLElement',
  embed: 'HTMLEmbedElement',
  fieldset: 'HTMLFieldSetElement',
  figcaption: 'HTMLElement',
  figure: 'HTMLElement',
  footer: 'HTMLElement',
  form: 'HTMLFormElement',
  h1: 'HTMLHeadingElement',
  h2: 'HTMLHeadingElement',
  h3: 'HTMLHeadingElement',
  h4: 'HTMLHeadingElement',
  h5: 'HTMLHeadingElement',
  h6: 'HTMLHeadingElement',
  head: 'HTMLHeadElement',
  header: 'HTMLElement',
  hgroup: 'HTMLElement',
  hr: 'HTMLHRElement',
  html: 'HTMLHtmlElement',
  i: 'HTMLElement',
  iframe: 'HTMLIFrameElement',
  img: 'HTMLImageElement',
  input: 'HTMLInputElement',
  ins: 'HTMLModElement',
  kbd: 'HTMLElement',
  label: 'HTMLLabelElement',
  legend: 'HTMLLegendElement',
  li: 'HTMLLIElement',
  link: 'HTMLLinkElement',
  main: 'HTMLElement',
  map: 'HTMLMapElement',
  mark: 'HTMLElement',
  menu: 'HTMLMenuElement',
  meta: 'HTMLMetaElement',
  meter: 'HTMLMeterElement',
  nav: 'HTMLElement',
  noscript: 'HTMLElement',
  object: 'HTMLObjectElement',
  ol: 'HTMLOListElement',
  optgroup: 'HTMLOptGroupElement',
  option: 'HTMLOptionElement',
  output: 'HTMLOutputElement',
  p: 'HTMLParagraphElement',
  picture: 'HTMLPictureElement',
  pre: 'HTMLPreElement',
  progress: 'HTMLProgressElement',
  q: 'HTMLQuoteElement',
  rp: 'HTMLElement',
  rt: 'HTMLElement',
  ruby: 'HTMLElement',
  s: 'HTMLElement',
  samp: 'HTMLElement',
  script: 'HTMLScriptElement',
  search: 'HTMLElement',
  section: 'HTMLElement',
  select: 'HTMLSelectElement',
  slot: 'HTMLSlotElement',
  small: 'HTMLElement',
  source: 'HTMLSourceElement',
  span: 'HTMLSpanElement',
  strong: 'HTMLElement',
  style: 'HTMLStyleElement',
  sub: 'HTMLElement',
  summary: 'HTMLElement',
  sup: 'HTMLElement',
  table: 'HTMLTableElement',
  tbody: 'HTMLTableSectionElement',
  td: 'HTMLTableCellElement',
  template: 'HTMLTemplateElement',
  textarea: 'HTMLTextAreaElement',
  tfoot: 'HTMLTableSectionElement',
  th: 'HTMLTableCellElement',
  thead: 'HTMLTableSectionElement',
  time: 'HTMLTimeElement',
  title: 'HTMLTitleElement',
  tr: 'HTMLTableRowElement',
  track: 'HTMLTrackElement',
  u: 'HTMLElement',
  ul: 'HTMLUListElement',
  var: 'HTMLElement',
  video: 'HTMLVideoElement',
  wbr: 'HTMLElement',
};

const html = readFileSync('./src/index.html', 'utf8');
const $ = load(html);

const ids = [];
$('[id]').each((_, el) => {
  const id = $(el).attr('id');
  if (id && !ids.includes(id)) {
    ids.push({ tag: $(el).get(0).tagName, id });
  }
});

const output =
  "// don't edit this file please use npm run generate:element\n" +
  "import { getElementByIdStrict } from './utils/getElementByIdStrict'\n" +
  ids
    .map(
      ({ tag, id }) =>
        `export const ${id} = /*#__PURE__*/ getElementByIdStrict<${
          HTMLElementTagNameMap[tag] || 'HTMLElement'
        }>("${id}");\n`,
    )
    .join('');

writeFileSync('./src/element.generated.ts', output, 'utf8');
