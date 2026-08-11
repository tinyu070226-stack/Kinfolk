class SyncController {
    constructor() {
        this.token = localStorage.getItem('gh_token') || '';
        this.repo = localStorage.getItem('gh_repo') || '';
        this.branch = localStorage.getItem('gh_branch') || 'main';
        this.offlineQueue = [];
    }

    setCredentials(token, repo, branch) {
        this.token = token;
        this.repo = repo;
        this.branch = branch;
        localStorage.setItem('gh_token', token);
        localStorage.setItem('gh_repo', repo);
        localStorage.setItem('gh_branch', branch);
    }

    async syncNote(noteId, payload) {
        if (!this.token || !this.repo) {
            this.saveLocal(noteId, payload);
            return { status: 'offline' };
        }

        const path = `notes/${noteId}.json`;
        const url = `https://api.github.com/repos/${this.repo}/contents/${path}`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

        try {
            // First get the SHA if file exists
            let sha = null;
            const getRes = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            }

            // Put the new content
            const putRes = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update note ${noteId}`,
                    content: content,
                    branch: this.branch,
                    sha: sha || undefined
                })
            });

            if (!putRes.ok) throw new Error('Failed to push to GitHub');

            this.saveLocal(noteId, payload);
            return { status: 'success' };
        } catch (e) {
            console.error(e);
            this.saveLocal(noteId, payload);
            return { status: 'error' };
        }
    }

    saveLocal(noteId, payload) {
        localStorage.setItem(`note_${noteId}`, JSON.stringify(payload));
    }

    getLocal(noteId) {
        const data = localStorage.getItem(`note_${noteId}`);
        return data ? JSON.parse(data) : null;
    }

    getAllLocalNotes() {
        const notes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('note_')) {
                notes.push(JSON.parse(localStorage.getItem(key)));
            }
        }
        return notes.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async pullLatest() {
        if (!this.token || !this.repo) return { status: 'offline' };
        
        try {
            const url = `https://api.github.com/repos/${this.repo}/contents/notes?ref=${this.branch}`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!res.ok) {
                if (res.status === 404) return { status: 'success', count: 0 }; // No notes folder yet
                throw new Error('Failed to fetch notes list');
            }
            
            const files = await res.json();
            if (!Array.isArray(files)) throw new Error('Invalid notes format');
            
            let pullCount = 0;
            
            for (const file of files) {
                if (file.type === 'file' && file.name.endsWith('.json')) {
                    const noteId = file.name.replace('.json', '');
                    const localNote = this.getLocal(noteId);
                    
                    const fileRes = await fetch(file.url, {
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Accept': 'application/vnd.github.v3.raw'
                        }
                    });
                    
                    if (fileRes.ok) {
                        const remoteNote = await fileRes.json();
                        if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
                            this.saveLocal(noteId, remoteNote);
                            pullCount++;
                        }
                    }
                }
            }
            
            return { status: 'success', count: pullCount };
        } catch (e) {
            console.error(e);
            return { status: 'error' };
        }
    }
}
window.SyncController = SyncController;
