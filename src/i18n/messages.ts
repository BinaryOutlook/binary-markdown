// Internationalization support - Dynamic loading version
import * as path from 'path';

// Type definitions
export interface Messages {
  openMarkdownFirst: string;
  numberOfRows: string;
  numberOfColumns: string;
  enterValidNumber: string;
  pdfExportComingSoon: string;
  imageDirChanged: string;
  fileModifiedExternally: string;
  reload: string;
  ignore: string;
  enterUrl: string;
  enterLinkText: string;
  copyLinkAddress: string;
  linkUnavailable: string;
  linkNotFound: string;
  linkNoPermissions: string;
  linkOpenFailed: string;
  linkCopyFailed: string;
  enterImageDir: string;
  imageDirCleared: string;
  forceRelativeNo: string;
  forceRelativeYes: string;
  forceRelativePrompt: string;
  forceRelativeTitle: string;
  imageDirSet: string;
  relativePathOn: string;
  failedToCopyImage: string;
  failedToSaveImage: string;
  imageFileNotFound: string;
  failedToProcessImage: string;
  selectImage: string;
  selectFileToCompare: string;
}

export interface WebviewMessages {
  languagePickerLabel: string;
  languagePickerPlaceholder: string;
  languagePickerNoResults: string;
  languagePickerCurrent: string;
  languagePickerPlainText: string;
  languagePickerMath: string;
  languagePickerMermaid: string;

  widthIndicatorsLabel: string;
  widthIndicatorsHelp: string;
  widthBoundaryExplanation: string;
  widthIndicatorsSaveFailed: string;

  editorAlignmentLabel: string;
  editorAlignmentLeft: string;
  editorAlignmentCenter: string;
  editorAlignmentRight: string;
  editorAlignmentHelp: string;
  editorAlignmentInvalid: string;
  editorAlignmentSaveFailed: string;

  editorWidthLabel: string;
  editorWidthDefault: string;
  editorWidthFull: string;
  editorWidthCustom: string;
  editorMaxWidthLabel: string;
  editorWidthHelp: string;
  editorWidthInvalid: string;
  editorWidthSaveFailed: string;

  tableControls: string;
  tableMenu: string;
  tablePlacement: string;
  tablePositionAuto: string;
  tablePositionTopBar: string;
  tablePositionFixed: string;
  tablePositionTopLeft: string;
  tablePositionTopRight: string;
  tablePositionBottomLeft: string;
  tablePositionBottomRight: string;
  tablePositionLeft: string;
  tablePositionRight: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;

  frontMatter: string;
  insertToc: string;
  refreshToc: string;
  tocContents: string;
  tocPending: string;
  closeOutline: string;
  openOutline: string;
  openInTextEditor: string;
  toggleSourceMode: string;
  bold: string;
  italic: string;
  strikethrough: string;
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  heading5: string;
  heading6: string;
  unorderedList: string;
  orderedList: string;
  taskList: string;
  blockquote: string;
  inlineCode: string;
  codeBlock: string;
  deleteCodeBlock: string;
  insertLink: string;
  insertImage: string;
  setImageDir: string;
  openExtensionSettings: string;
  insertTable: string;
  horizontalRule: string;
  mermaidBlock: string;
  mathBlock: string;
  inlineMath: string;
  editEquation: string;
  equationEditHint: string;
  searchPlaceholder: string;
  replacePlaceholder: string;
  searchPrev: string;
  searchNext: string;
  toggleReplace: string;
  closeSearch: string;
  replace: string;
  replaceAll: string;
  caseSensitive: string;
  wholeWord: string;
  regex: string;
  addColLeft: string;
  addColRight: string;
  deleteCol: string;
  addRowAbove: string;
  addRowBelow: string;
  deleteRow: string;
  // Status bar
  words: string;
  characters: string;
  lines: string;
  linesCount: string;
  livePreviewMode: string;
  sourceMode: string;
  relativePath: string;
  externalChangeToast: string;
  undo: string;
  redo: string;
  // Image directory source labels
  imageDirLabel: string;
  imageDirSourceFile: string;
  imageDirSourceSettings: string;
  imageDirSourceDefault: string;
}

// Supported locales
const SUPPORTED_LOCALES = ['en', 'ja', 'zh-tw', 'zh-cn', 'ko', 'es', 'fr'];

// Locale aliases
const LOCALE_ALIASES: Record<string, string> = {
  'zh-hant': 'zh-tw',
  'zh-hans': 'zh-cn',
  'zh': 'zh-cn',
};

// Current state
let currentLocale: string = 'en';
let currentMessages: { messages: Messages; webviewMessages: WebviewMessages } | null = null;
let fallbackMessages: { messages: Messages; webviewMessages: WebviewMessages } | null = null;

/**
 * Resolve locale to a supported one
 */
function resolveLocale(lang: string): string {
  const lower = lang.toLowerCase();
  
  // Exact match
  if (SUPPORTED_LOCALES.includes(lower)) {
    return lower;
  }
  
  // Alias match
  if (LOCALE_ALIASES[lower]) {
    return LOCALE_ALIASES[lower];
  }
  
  // Base language match (e.g., 'ja-JP' -> 'ja')
  const base = lower.split('-')[0];
  if (SUPPORTED_LOCALES.includes(base)) {
    return base;
  }
  
  return 'en';
}

/**
 * Resolve effective language from configured language and system language
 * @param configLang - Configured value ('default' or a specific locale).
 * @param systemLang - System language (VS Code: vscode.env.language; Electron: app.getLocale()).
 */
function resolveEffectiveLanguage(configLang: string, systemLang: string): string {
  if (!configLang || configLang === 'default') {
    return systemLang;
  }
  return configLang;
}

/**
 * Load locale file dynamically
 */
function loadLocale(locale: string): { messages: Messages; webviewMessages: WebviewMessages } | null {
  try {
    // __dirname points to out/i18n/
    // Locale files are in out/locales/
    const localePath = path.join(__dirname, '..', 'locales', `${locale}.js`);
    
    // Clear cache for hot reload on settings change
    try {
      delete require.cache[require.resolve(localePath)];
    } catch {
      // Ignore if not in cache
    }
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const localeModule = require(localePath);
    return {
      messages: localeModule.messages,
      webviewMessages: localeModule.webviewMessages,
    };
  } catch (error) {
    console.error(`[Binary Markdown] Failed to load locale '${locale}':`, error);
    return null;
  }
}

/**
 * Initialize locale (called on activation and settings change)
 * @param configLang - Configured value ('default' or a specific locale).
 * @param systemLang - System language (VS Code: vscode.env.language; Electron: app.getLocale()).
 */
export function initLocale(configLang: string, systemLang: string): void {
  const lang = resolveEffectiveLanguage(configLang, systemLang);
  currentLocale = resolveLocale(lang);
  
  // Load fallback (English) first
  if (!fallbackMessages) {
    fallbackMessages = loadLocale('en');
    if (!fallbackMessages) {
      console.error('[Binary Markdown] Failed to load fallback locale (en)');
    }
  }
  
  // Load current locale
  if (currentLocale === 'en') {
    currentMessages = fallbackMessages;
  } else {
    currentMessages = loadLocale(currentLocale);
    if (!currentMessages) {
      console.warn(`[Binary Markdown] Falling back to English`);
      currentMessages = fallbackMessages;
      currentLocale = 'en';
    }
  }
  
  console.log(`[Binary Markdown] Language: ${currentLocale} (configured: ${lang})`);
}

/**
 * Get translated message for extension
 */
export function t(key: keyof Messages): string {
  const messages = currentMessages?.messages || fallbackMessages?.messages;
  return messages?.[key] || key;
}

/**
 * Get current locale
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Get webview messages for current locale
 */
export function getWebviewMessages(): WebviewMessages {
  return currentMessages?.webviewMessages || fallbackMessages?.webviewMessages || {} as WebviewMessages;
}

/**
 * Get list of supported locales
 */
export function getSupportedLocales(): string[] {
  return [...SUPPORTED_LOCALES];
}
