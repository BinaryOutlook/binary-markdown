import { BrowserWindow } from 'electron';

/** Electron does not implement window.prompt; use a modal HTML form in its editor. */
export async function showLinkDialog(win: BrowserWindow, text: string, messages: Record<string, string>): Promise<{ url: string; text: string } | undefined> {
    const values = {
        text,
        title: messages.insertLinkTitle || 'Insert link',
        url: messages.insertLinkUrl || 'URL or file path',
        label: messages.insertLinkText || 'Link text',
        insert: messages.commandPaletteInsert || 'Insert',
        cancel: messages.insertDialogCancel || 'Cancel'
    };
    return win.webContents.executeJavaScript(`new Promise(resolve => {
        const values = ${JSON.stringify(values)};
        const dialog = document.createElement('dialog');
        dialog.className = 'host-link-dialog';
        dialog.setAttribute('aria-labelledby', 'host-link-dialog-title');
        dialog.style.cssText = 'width:360px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);overflow:auto;margin:auto;padding:20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-color);color:var(--text-color);font:14px system-ui;';
        const form = document.createElement('form');
        const heading = document.createElement('h2');
        heading.id = 'host-link-dialog-title'; heading.textContent = values.title;
        heading.style.cssText = 'font-size:17px;margin:0 0 16px;';
        form.appendChild(heading);
        function field(label, value, name) {
            const wrapper = document.createElement('label');
            wrapper.style.cssText = 'display:block;margin:12px 0;';
            const caption = document.createElement('span'); caption.textContent = label;
            const input = document.createElement('input');
            input.name = name; input.type = 'text'; input.value = value;
            input.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:7px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-color);color:var(--text-color);font:inherit;';
            wrapper.append(caption, input); form.appendChild(wrapper); return input;
        }
        const url = field(values.url, '', 'url'); url.required = true;
        const text = field(values.label, values.text, 'text');
        const actions = document.createElement('div'); actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:18px;';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = values.cancel;
        const insert = document.createElement('button'); insert.type = 'submit'; insert.textContent = values.insert;
        for (const button of [cancel, insert]) button.style.cssText = 'font:inherit;padding:6px 12px;border:1px solid var(--border-color);border-radius:4px;background:var(--toolbar-bg);color:var(--text-color);cursor:pointer;';
        cancel.addEventListener('click', () => dialog.close('cancel'));
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (url.value.trim()) dialog.close('insert');
        });
        dialog.addEventListener('close', () => {
            const result = dialog.returnValue === 'insert' ? { url: url.value.trim(), text: text.value || url.value.trim() } : undefined;
            dialog.remove(); resolve(result);
        }, { once: true });
        actions.append(cancel, insert); form.appendChild(actions); dialog.appendChild(form);
        document.body.appendChild(dialog); dialog.showModal(); url.focus();
    })`);
}
