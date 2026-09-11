import { getLocale } from '../i18n/messages';

const en = {
    title: 'Export',
    experimental: 'Experimental export',
    limitations: 'HTML/PDF follow the supported preview. DOCX/EPUB prioritize editable structure. Unsupported content uses a visible fallback and warnings.',
    saveRequired: 'Save this Markdown file, then retry export.',
    unsupportedHost: 'Experimental export requires local desktop VS Code on macOS or Linux.',
    unsupportedRemote: 'Export is not yet supported in remote windows, including Remote-SSH. Open a local copy of the Markdown file and its referenced assets in desktop VS Code on macOS or Linux to export.',
    trustRequired: 'Trust this workspace before using export.',
    setup: 'Export settings and installation',
    cancel: 'Cancel export',
    checking: 'Checking saved document…',
    dependencies: 'Checking export tools…',
    resources: 'Preparing referenced resources…',
    rendering: 'Rendering the document…',
    converting: 'Converting the document…',
    saving: 'Saving the exported file…',
    completed: 'Export complete',
    reused: 'Reused an identical existing export',
    cancelled: 'Export cancelled',
    failed: 'Export failed',
    warnings: 'Export warnings',
    openOutput: 'Open exported file',
    busy: 'An export is already running.',
    available: 'Available',
    unavailable: 'Setup required',
    blocked: 'Unavailable',
    detecting: 'Checking tools…',
    pandocInstall: 'DOCX and EPUB require Pandoc. Install it, or configure its executable path in Export settings.',
    browserInstall: 'PDF requires an installed compatible Chrome/Chromium browser. Install it, or configure its executable path in Export settings.'
};

export type ExportMessages = { [K in keyof typeof en]: string };

const translations: Record<string, ExportMessages> = {
    en,
    ja: {
        unsupportedRemote: 'Remote-SSHを含むリモートウィンドウでのエクスポートはまだサポートされていません。Markdownファイルと参照する素材をローカルにコピーし、macOSまたはLinuxのデスクトップ版VS Codeで開いてエクスポートしてください。', blocked: '利用不可',
        title: 'エクスポート', experimental: '試験提供のエクスポート',
        limitations: 'HTML/PDFは対応するプレビューを再現します。DOCX/EPUBは編集可能な構造を優先します。未対応の内容には代替表示と警告を付けます。',
        saveRequired: 'Markdownファイルを保存してから、もう一度エクスポートしてください。',
        unsupportedHost: '試験提供のエクスポートには、macOSまたはLinux上のローカルデスクトップ版VS Codeが必要です。', trustRequired: 'エクスポートするには、このワークスペースを信頼してください。',
        setup: 'エクスポートの設定とインストール', cancel: 'エクスポートをキャンセル', checking: '保存済み文書を確認中…', dependencies: 'エクスポートツールを確認中…',
        resources: '参照リソースを準備中…', rendering: '文書を描画中…', converting: '文書を変換中…', saving: '出力ファイルを保存中…',
        completed: 'エクスポート完了', reused: '同一内容の既存ファイルを再利用しました', cancelled: 'エクスポートをキャンセルしました', failed: 'エクスポートに失敗しました',
        warnings: 'エクスポートの警告', openOutput: '出力ファイルを開く', busy: 'エクスポートはすでに実行中です。', available: '利用可能', unavailable: '設定が必要', detecting: 'ツールを確認中…',
        pandocInstall: 'DOCXとEPUBにはPandocが必要です。インストールするか、エクスポート設定で実行ファイルのパスを指定してください。',
        browserInstall: 'PDFには対応するChrome/Chromiumブラウザーが必要です。インストールするか、エクスポート設定で実行ファイルのパスを指定してください。'
    },
    'zh-cn': {
        unsupportedRemote: '暂不支持在Remote-SSH等远程窗口中导出。请将Markdown文件及其引用的资源复制到本地，再用macOS或Linux上的桌面版VS Code打开并导出。', blocked: '不可用',
        title: '导出', experimental: '实验性导出', limitations: 'HTML/PDF遵循已支持的预览效果。DOCX/EPUB优先保留可编辑结构。不支持的内容将显示替代内容和警告。',
        saveRequired: '请先保存此Markdown文件，然后重试导出。', unsupportedHost: '实验性导出需要macOS或Linux上的本地桌面版VS Code。', trustRequired: '请先信任此工作区，再使用导出。',
        setup: '导出设置与安装说明', cancel: '取消导出', checking: '正在检查已保存的文档…', dependencies: '正在检查导出工具…', resources: '正在准备引用的资源…',
        rendering: '正在渲染文档…', converting: '正在转换文档…', saving: '正在保存导出文件…', completed: '导出完成', reused: '已复用内容完全相同的现有导出文件',
        cancelled: '已取消导出', failed: '导出失败', warnings: '导出警告', openOutput: '打开导出文件', busy: '已有导出任务正在进行。', available: '可用', unavailable: '需要设置', detecting: '正在检查工具…',
        pandocInstall: 'DOCX和EPUB需要Pandoc。请安装Pandoc，或在导出设置中指定其可执行文件路径。', browserInstall: 'PDF需要兼容的Chrome/Chromium浏览器。请安装浏览器，或在导出设置中指定其可执行文件路径。'
    },
    'zh-tw': {
        unsupportedRemote: '尚不支援在Remote-SSH等遠端視窗中匯出。請將Markdown檔案及其引用的資源複製到本機，再用macOS或Linux上的桌面版VS Code開啟並匯出。', blocked: '無法使用',
        title: '匯出', experimental: '實驗性匯出', limitations: 'HTML/PDF遵循已支援的預覽效果。DOCX/EPUB優先保留可編輯結構。不支援的內容將顯示替代內容和警告。',
        saveRequired: '請先儲存此Markdown檔案，然後重試匯出。', unsupportedHost: '實驗性匯出需要macOS或Linux上的本機桌面版VS Code。', trustRequired: '請先信任此工作區，再使用匯出。',
        setup: '匯出設定與安裝說明', cancel: '取消匯出', checking: '正在檢查已儲存的文件…', dependencies: '正在檢查匯出工具…', resources: '正在準備引用的資源…',
        rendering: '正在繪製文件…', converting: '正在轉換文件…', saving: '正在儲存匯出檔案…', completed: '匯出完成', reused: '已重用內容完全相同的現有匯出檔案',
        cancelled: '已取消匯出', failed: '匯出失敗', warnings: '匯出警告', openOutput: '開啟匯出檔案', busy: '已有匯出工作正在進行。', available: '可用', unavailable: '需要設定', detecting: '正在檢查工具…',
        pandocInstall: 'DOCX與EPUB需要Pandoc。請安裝Pandoc，或在匯出設定中指定其執行檔路徑。', browserInstall: 'PDF需要相容的Chrome/Chromium瀏覽器。請安裝瀏覽器，或在匯出設定中指定其執行檔路徑。'
    },
    ko: {
        unsupportedRemote: 'Remote-SSH를 비롯한 원격 창에서는 아직 내보내기를 지원하지 않습니다. Markdown 파일과 참조 리소스를 로컬에 복사한 후 macOS 또는 Linux의 데스크톱 VS Code에서 열어 내보내세요.', blocked: '사용 불가',
        title: '내보내기', experimental: '실험적 내보내기', limitations: 'HTML/PDF는 지원되는 미리보기를 따릅니다. DOCX/EPUB는 편집 가능한 구조를 우선합니다. 지원되지 않는 내용에는 대체 표시와 경고를 제공합니다.',
        saveRequired: 'Markdown 파일을 저장한 다음 내보내기를 다시 시도하세요.', unsupportedHost: '실험적 내보내기에는 macOS 또는 Linux의 로컬 데스크톱 VS Code가 필요합니다.', trustRequired: '내보내기를 사용하려면 이 작업 영역을 신뢰하세요.',
        setup: '내보내기 설정 및 설치 안내', cancel: '내보내기 취소', checking: '저장된 문서 확인 중…', dependencies: '내보내기 도구 확인 중…', resources: '참조 리소스 준비 중…',
        rendering: '문서 렌더링 중…', converting: '문서 변환 중…', saving: '내보낸 파일 저장 중…', completed: '내보내기 완료', reused: '내용이 동일한 기존 내보내기 파일을 재사용했습니다',
        cancelled: '내보내기 취소됨', failed: '내보내기 실패', warnings: '내보내기 경고', openOutput: '내보낸 파일 열기', busy: '이미 내보내기가 진행 중입니다.', available: '사용 가능', unavailable: '설정 필요', detecting: '도구 확인 중…',
        pandocInstall: 'DOCX와 EPUB에는 Pandoc이 필요합니다. 설치하거나 내보내기 설정에서 실행 파일 경로를 지정하세요.', browserInstall: 'PDF에는 호환되는 Chrome/Chromium 브라우저가 필요합니다. 설치하거나 내보내기 설정에서 실행 파일 경로를 지정하세요.'
    },
    fr: {
        unsupportedRemote: 'L’export n’est pas encore pris en charge dans les fenêtres distantes, y compris Remote-SSH. Copiez le fichier Markdown et ses ressources référencées en local, puis ouvrez-les dans VS Code pour ordinateur sur macOS ou Linux pour exporter.', blocked: 'Indisponible',
        title: 'Exporter', experimental: 'Export expérimental', limitations: 'HTML/PDF suivent l’aperçu pris en charge. DOCX/EPUB privilégient une structure modifiable. Les éléments non pris en charge restent visibles avec un avertissement.',
        saveRequired: 'Enregistrez ce fichier Markdown, puis réessayez l’export.', unsupportedHost: 'L’export expérimental nécessite VS Code pour ordinateur, exécuté localement sur macOS ou Linux.', trustRequired: 'Accordez votre confiance à cet espace de travail pour exporter.',
        setup: 'Paramètres et installation de l’export', cancel: 'Annuler l’export', checking: 'Vérification du document enregistré…', dependencies: 'Vérification des outils d’export…', resources: 'Préparation des ressources référencées…',
        rendering: 'Rendu du document…', converting: 'Conversion du document…', saving: 'Enregistrement du fichier exporté…', completed: 'Export terminé', reused: 'Un export existant identique a été réutilisé',
        cancelled: 'Export annulé', failed: 'Échec de l’export', warnings: 'Avertissements de l’export', openOutput: 'Ouvrir le fichier exporté', busy: 'Un export est déjà en cours.', available: 'Disponible', unavailable: 'Configuration requise', detecting: 'Vérification des outils…',
        pandocInstall: 'DOCX et EPUB nécessitent Pandoc. Installez-le ou indiquez son exécutable dans les paramètres d’export.', browserInstall: 'PDF nécessite un navigateur Chrome/Chromium compatible. Installez-le ou indiquez son exécutable dans les paramètres d’export.'
    },
    es: {
        unsupportedRemote: 'La exportación aún no está disponible en ventanas remotas, incluido Remote-SSH. Copia el archivo Markdown y sus recursos referenciados al equipo local y ábrelos en VS Code de escritorio para macOS o Linux para exportar.', blocked: 'No disponible',
        title: 'Exportar', experimental: 'Exportación experimental', limitations: 'HTML/PDF siguen la vista previa compatible. DOCX/EPUB priorizan la estructura editable. El contenido no compatible se conserva como alternativa visible con avisos.',
        saveRequired: 'Guarda este archivo Markdown y vuelve a intentar la exportación.', unsupportedHost: 'La exportación experimental requiere VS Code de escritorio ejecutado localmente en macOS o Linux.', trustRequired: 'Confía en este espacio de trabajo para exportar.',
        setup: 'Configuración e instalación de exportación', cancel: 'Cancelar exportación', checking: 'Comprobando el documento guardado…', dependencies: 'Comprobando las herramientas de exportación…', resources: 'Preparando los recursos referenciados…',
        rendering: 'Renderizando el documento…', converting: 'Convirtiendo el documento…', saving: 'Guardando el archivo exportado…', completed: 'Exportación completada', reused: 'Se reutilizó una exportación existente idéntica',
        cancelled: 'Exportación cancelada', failed: 'Error de exportación', warnings: 'Avisos de exportación', openOutput: 'Abrir el archivo exportado', busy: 'Ya hay una exportación en curso.', available: 'Disponible', unavailable: 'Requiere configuración', detecting: 'Comprobando herramientas…',
        pandocInstall: 'DOCX y EPUB requieren Pandoc. Instálalo o indica su ejecutable en la configuración de exportación.', browserInstall: 'PDF requiere un navegador Chrome/Chromium compatible. Instálalo o indica su ejecutable en la configuración de exportación.'
    }
};

/** Runtime language is independent of native VS Code settings localization. */
export function getExportMessages(): ExportMessages {
    return { ...(translations[getLocale()] || en) };
}
