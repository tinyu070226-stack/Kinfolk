class SyncController {
    constructor() {
        this.token = (localStorage.getItem(" gh_token\) || \\).trim();
 this.repo = (localStorage.getItem(\gh_repo\) || \\).trim();
 this.branch = (localStorage.getItem(\gh_branch\) || \main\).trim();
 }

 setCredentials(token, repo, branch) {
 this.token = (token || \\).trim();
 this.repo = (repo || \\).trim();
 this.branch = (branch || \main\).trim();
 localStorage.setItem(\gh_token\, this.token);
 localStorage.setItem(\gh_repo\, this.repo);
 localStorage.setItem(\gh_branch\, this.branch);
 }

 async syncNote(noteId, payload) {
 this.saveLocal(noteId, payload);
 if (!this.token || !this.repo) return { status: \offline\ };

 const path = \notes/\ + noteId + \.json\;
 const url = \https://api.github.com/repos/\ + this.repo + \/contents/\ + path;
 
 try {
 const jsonStr = JSON.stringify(payload);
 const bytes = new TextEncoder().encode(jsonStr);
 let binStr = \\;
 for (let i = 0; i < bytes.length; i++) {
 binStr += String.fromCharCode(bytes[i]);
 }
 const content = btoa(binStr);

 let sha = null;
 const getRes = await fetch(url + \?ref=\ + this.branch, {
 headers: {
 \Authorization\: \token \ + this.token,
 \Accept\: \application/vnd.github.v3+json\
 }
 });
 
 if (getRes.ok) {
 const data = await getRes.json();
 sha = data.sha;
 }

 const putRes = await fetch(url, {
 method: \PUT\,
 headers: {
 \Authorization\: \token \ + this.token,
 \Accept\: \application/vnd.github.v3+json\,
 \Content-Type\: \application/json\
 },
 body: JSON.stringify({
 message: \Update note \ + noteId,
 content: content,
 branch: this.branch,
 sha: sha || undefined
 })
 });

 if (!putRes.ok) {
 console.error(\GitHub PUT failed:\, await putRes.text());
 throw new Error(\GitHub PUT failed\);
 }

 return { status: \success\ };
 } catch (e) {
 console.error(\Sync error:\, e);
 return { status: \error\, error: e.message };
 }
 }

 async deleteNote(noteId) {
 localStorage.removeItem(\note_\ + noteId);
 if (!this.token || !this.repo) return { status: \offline\ };

 const path = \notes/\ + noteId + \.json\;
 const url = \https://api.github.com/repos/\ + this.repo + \/contents/\ + path;

 try {
 let sha = null;
 const getRes = await fetch(url + \?ref=\ + this.branch, {
 headers: {
 \Authorization\: \token \ + this.token,
 \Accept\: \application/vnd.github.v3+json\
 }
 });
 
 if (getRes.ok) {
 const data = await getRes.json();
 sha = data.sha;
 
 const delRes = await fetch(url, {
 method: \DELETE\,
 headers: {
 \Authorization\: \token \ + this.token,
 \Accept\: \application/vnd.github.v3+json\,
 \Content-Type\: \application/json\
 },
 body: JSON.stringify({
 message: \Delete note \ + noteId,
 branch: this.branch,
 sha: sha
 })
 });

 if (!delRes.ok) console.error(\GitHub DELETE failed:\, await delRes.text());
 }

 return { status: \success\ };
 } catch (e) {
 console.error(\Delete sync error:\, e);
 return { status: \error\, error: e.message };
 }
 }

 saveLocal(noteId, payload) {
 try {
 localStorage.setItem(\note_\ + noteId, JSON.stringify(payload));
 } catch(e) {
 console.error(\LocalStorage full\, e);
 }
 }

 getLocal(noteId) {
 const data = localStorage.getItem(\note_\ + noteId);
 return data ? JSON.parse(data) : null;
 }

 getAllLocalNotes() {
 const notes = [];
 for (let i = 0; i < localStorage.length; i++) {
 const key = localStorage.key(i);
 if (key && key.startsWith(\note_\)) {
 try {
 notes.push(JSON.parse(localStorage.getItem(key)));
 } catch(e){}
 }
 }
 return notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
 }

 async pullLatest() {
 if (!this.token || !this.repo) return { status: \offline\ };
 
 try {
 const url = \https://api.github.com/repos/\ + this.repo + \/contents/notes?ref=\ + this.branch;
 const res = await fetch(url, {
 headers: {
 \Authorization\: \token \ + this.token,
 \Accept\: \application/vnd.github.v3+json\
 }
 });
 
 if (!res.ok) {
 if (res.status === 404) return { status: \success\, count: 0 };
 throw new Error(\Failed to fetch notes list\);
 }
 
 const files = await res.json();
 if (!Array.isArray(files)) throw new Error(\Invalid notes format\);
 
 // Delete local notes that no longer exist on GitHub if user is synced
 const remoteIds = new Set();
 let pullCount = 0;
 
 for (const file of files) {
 if (file.type === \file\ && file.name.endsWith(\.json\)) {
 const noteId = file.name.replace(\.json\, \\);
 remoteIds.add(noteId);
 const localNote = this.getLocal(noteId);
 
 const fileRes = await fetch(file.download_url || file.url, {
 headers: {
 \Authorization\: \token \ + this.token
 }
 });
 
 if (fileRes.ok) {
 const remoteNote = await fileRes.json();
 if (!localNote || (remoteNote.updatedAt && remoteNote.updatedAt > (localNote.updatedAt || 0))) {
 this.saveLocal(noteId, remoteNote);
 pullCount++;
 }
 }
 }
 }

 // Sync deleted notes from remote
 const localNotes = this.getAllLocalNotes();
 localNotes.forEach(ln => {
 if (!remoteIds.has(ln.id)) {
 localStorage.removeItem(\note_\ + ln.id);
 }
 });
 
 return { status: \success\, count: pullCount };
 } catch (e) {
 console.error(\Pull error:\, e);
 return { status: \error\, error: e.message };
 }
 }
}
window.SyncController = SyncController;

