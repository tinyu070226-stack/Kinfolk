class SyncController {
    constructor() {
        this.token = (localStorage.getItem('gh_token') || '').trim();
        this.repo = (localStorage.getItem('gh_repo') || '').trim();
        this.branch = (localStorage.getItem('gh_branch') || 'main').trim();
    }

    setCredentials(token, repo, branch) {
        this.token = (token || '').trim();
        this.repo = (repo || '').trim();
        this.branch = (branch || 'main').trim();
        localStorage.setItem('gh_token', this.token);
        localStorage.setItem('gh_repo', this.repo);
        localStorage.setItem('gh_branch', this.branch);
    }

    // UTF-8 safe base64 encode
    _toBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    _headers() {
        return {
            'Authorization': 'token ' + this.token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    async _getFileSha(url) {
        const res = await fetch(url + '?ref=' + this.branch, {
            headers: { 'Authorization': 'token ' + this.token, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (res.ok) {
            const data = await res.json();
            return data.sha || null;
        }
        return null;
    }

    saveLocal(noteId, payload) {
        try {
            localStorage.setItem('note_' + noteId, JSON.stringify(payload));
        } catch (e) {
            console.error('LocalStorage full:', e);
        }
    }

    getLocal(noteId) {
        const data = localStorage.getItem('note_' + noteId);
        return data ? JSON.parse(data) : null;
    }

    getAllLocalNotes() {
        const notes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('note_')) {
                try {
                    const parsed = JSON.parse(localStorage.getItem(key));
                    if (parsed && parsed.id) notes.push(parsed);
                } catch (e) {}
            }
        }
        return notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    async syncNote(noteId, payload) {
        this.saveLocal(noteId, payload);
        if (!this.token || !this.repo) return { status: 'offline' };

        const path = 'notes/' + noteId + '.json';
        const url = 'https://api.github.com/repos/' + this.repo + '/contents/' + path;

        try {
            const content = this._toBase64(JSON.stringify(payload));
            const sha = await this._getFileSha(url);

            const body = {
                message: 'Update note ' + noteId,
                content: content,
                branch: this.branch
            };
            if (sha) body.sha = sha;

            const res = await fetch(url, {
                method: 'PUT',
                headers: this._headers(),
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('GitHub PUT failed:', errText);
                return { status: 'error', error: errText };
            }
            return { status: 'success' };
        } catch (e) {
            console.error('syncNote error:', e);
            return { status: 'error', error: e.message };
        }
    }

    async deleteNote(noteId) {
        // 1. Remove from localStorage
        localStorage.removeItem('note_' + noteId);

        // 2. If no credentials, done
        if (!this.token || !this.repo) return { status: 'offline' };

        const path = 'notes/' + noteId + '.json';
        const url = 'https://api.github.com/repos/' + this.repo + '/contents/' + path;

        try {
            const sha = await this._getFileSha(url);
            if (!sha) return { status: 'success' }; // File doesn't exist on remote

            const res = await fetch(url, {
                method: 'DELETE',
                headers: this._headers(),
                body: JSON.stringify({
                    message: 'Delete note ' + noteId,
                    sha: sha,
                    branch: this.branch
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('GitHub DELETE failed:', errText);
                return { status: 'error', error: errText };
            }
            return { status: 'success' };
        } catch (e) {
            console.error('deleteNote error:', e);
            return { status: 'error', error: e.message };
        }
    }

    async pullLatest() {
        if (!this.token || !this.repo) return { status: 'offline' };

        try {
            const url = 'https://api.github.com/repos/' + this.repo + '/contents/notes?ref=' + this.branch;
            const res = await fetch(url, {
                headers: { 'Authorization': 'token ' + this.token, 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!res.ok) {
                if (res.status === 404) return { status: 'success', count: 0 };
                throw new Error('Failed to list notes: HTTP ' + res.status);
            }

            const files = await res.json();
            if (!Array.isArray(files)) return { status: 'success', count: 0 };

            const remoteIds = new Set();
            let pullCount = 0;

            for (const file of files) {
                if (file.type !== 'file' || !file.name.endsWith('.json')) continue;

                const noteId = file.name.replace('.json', '');
                remoteIds.add(noteId);

                const localNote = this.getLocal(noteId);
                const fetchUrl = file.download_url;

                const fileRes = await fetch(fetchUrl, {
                    headers: { 'Authorization': 'token ' + this.token }
                });
                if (!fileRes.ok) continue;

                const remoteNote = await fileRes.json();
                const remoteTime = remoteNote.updatedAt || 0;
                const localTime = localNote ? (localNote.updatedAt || 0) : 0;

                if (!localNote || remoteTime > localTime) {
                    this.saveLocal(noteId, remoteNote);
                    pullCount++;
                }
            }

            // Remove local notes deleted on remote
            this.getAllLocalNotes().forEach(ln => {
                if (ln.id && !remoteIds.has(ln.id)) {
                    localStorage.removeItem('note_' + ln.id);
                }
            });

            return { status: 'success', count: pullCount };
        } catch (e) {
            console.error('pullLatest error:', e);
            return { status: 'error', error: e.message };
        }
    }
}

window.SyncController = SyncController;
