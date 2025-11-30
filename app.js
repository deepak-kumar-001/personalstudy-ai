// Global variables
let currentUser = null;
let documents = {};
let chatHistory = {};
let flashcardSets = {};
let studyNotes = {};
let stats = {
    documentsUploaded: 0,
    flashcardsCreated: 0,
    notesCreated: 0,
    questionsAsked: 0,
    studyTimeMinutes: 0,
    flashcardAccuracy: 0
};
let currentFlashcardIndex = 0;
let currentNoteId = null;
let studyStartTime = null;
let questionPapers = [];
let qpAnalysisSummary = "";
const API_BASE_URL = 'https://personalstudy-ai.onrender.com';

// Data Management with Supabase
async function loadData() {
    if (!currentUser) return;

    try {
        // Load documents
        const { data: docsData } = await supabase
            .from('documents')
            .select('*')
            .eq('user_id', currentUser.id);
        
        documents = {};
        if (docsData) {
            docsData.forEach(doc => {
                documents[doc.id] = {
                    name: doc.name,
                    content: doc.content,
                    uploadDate: doc.upload_date,
                    type: doc.type
                };
            });
        }

        // Load chat history
        const { data: chatData } = await supabase
            .from('chat_history')
            .select('*')
            .eq('user_id', currentUser.id);
        
        chatHistory = {};
        if (chatData) {
            chatData.forEach(chat => {
                if (!chatHistory[chat.document_id]) {
                    chatHistory[chat.document_id] = [];
                }
                chatHistory[chat.document_id].push({
                    question: chat.question,
                    answer: chat.answer,
                    timestamp: chat.created_at
                });
            });
        }

        // Load flashcard sets
        const { data: flashcardsData } = await supabase
            .from('flashcard_sets')
            .select('*')
            .eq('user_id', currentUser.id);
        
        flashcardSets = {};
        if (flashcardsData) {
            flashcardsData.forEach(set => {
                flashcardSets[set.id] = {
                    docName: set.doc_name,
                    cards: set.cards,
                    created: set.created_at
                };
            });
        }

        // Load study notes
        const { data: notesData } = await supabase
            .from('study_notes')
            .select('*')
            .eq('user_id', currentUser.id);
        
        studyNotes = {};
        if (notesData) {
            notesData.forEach(note => {
                studyNotes[note.id] = {
                    title: note.title,
                    content: note.content,
                    created: note.created_at,
                    modified: note.modified_at,
                    docName: note.doc_name
                };
            });
        }

        // Load stats
        const { data: statsData } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (statsData) {
            stats = {
                documentsUploaded: statsData.documents_uploaded || 0,
                flashcardsCreated: statsData.flashcards_created || 0,
                notesCreated: statsData.notes_created || 0,
                questionsAsked: statsData.questions_asked || 0,
                studyTimeMinutes: statsData.study_time_minutes || 0,
                flashcardAccuracy: statsData.flashcard_accuracy || 0
            };
        }

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function saveStats() {
    if (!currentUser) return;

    try {
        await supabase
            .from('user_stats')
            .upsert({
                user_id: currentUser.id,
                documents_uploaded: stats.documentsUploaded,
                flashcards_created: stats.flashcardsCreated,
                notes_created: stats.notesCreated,
                questions_asked: stats.questionsAsked,
                study_time_minutes: stats.studyTimeMinutes,
                flashcard_accuracy: stats.flashcardAccuracy,
                updated_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

// Authentication
function switchToSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}

function switchToLogin() {
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

async function handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!name || !email || !password) {
        alert('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name
                }
            }
        });

        if (error) throw error;

        alert('Account created successfully! Please check your email to verify your account, then login.');
        switchToLogin();
    } catch (error) {
        alert('Error: ' + error.message);
        console.error('Signup error:', error);
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        await loadData();
        
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        await loadAccountInfo();
        updateStats();
        loadDocumentList();
        loadNotesList();
        startStudyTimer();
        
    } catch (error) {
        alert('Error: ' + error.message);
        console.error('Login error:', error);
    }
}

async function handleLogout() {
    stopStudyTimer();
    await saveStats();
    
    try {
        await supabase.auth.signOut();
        currentUser = null;
        
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('auth-page').classList.remove('hidden');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function loadAccountInfo() {
    if (!currentUser) return;
    
    try {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            document.getElementById('account-name').value = profile.name;
            document.getElementById('account-email').value = profile.email;
            const joinedDate = new Date(profile.created_at).toLocaleDateString();
            document.getElementById('account-joined').value = joinedDate;
        }
    } catch (error) {
        console.error('Error loading account info:', error);
    }
}

// Navigation
function showPage(page) {
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    event.target.classList.add('active');
    
    if (page === 'dashboard') {
        showSection('documents-section');
    } else if (page === 'account') {
        hideAllSections();
        document.getElementById('account-section').classList.remove('hidden');
    } else if (page === 'settings') {
        hideAllSections();
        document.getElementById('settings-section').classList.remove('hidden');
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    event.target.classList.add('active');
}

function hideAllSections() {
    const sections = ['documents-section', 'qa-section', 'flashcards-section', 'notes-section', 'stats-section', 'question-paper-section', 'account-section', 'settings-section'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

// File Handling
async function handleFiles(files) {
    for (let file of files) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("${API_BASE_URL}/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            // Save to Supabase
            const { data: docData, error } = await supabase
                .from('documents')
                .insert({
                    user_id: currentUser.id,
                    name: data.filename,
                    content: data.content,
                    type: file.type
                })
                .select()
                .single();

            if (error) throw error;

            documents[docData.id] = {
                name: docData.name,
                content: docData.content,
                uploadDate: docData.upload_date,
                type: docData.type
            };

            stats.documentsUploaded++;
            await saveStats();
            loadDocumentList();
            updateStats();
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading file: ' + file.name);
        }
    }
}

function loadDocumentList() {
    const list = document.getElementById('document-list');
    const docSelect = document.getElementById('doc-select');
    const flashcardDocSelect = document.getElementById('flashcard-doc-select');
    const notesDocSelect = document.getElementById('notes-doc-select');
    
    list.innerHTML = '';
    docSelect.innerHTML = '<option value="">Select a document</option>';
    flashcardDocSelect.innerHTML = '<option value="">Select a document</option>';
    notesDocSelect.innerHTML = '<option value="">Select a document</option>';

    for (let [id, doc] of Object.entries(documents)) {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.innerHTML = `
            <div class="document-name">
                <span>📄</span>
                <span>${doc.name}</span>
            </div>
            <div class="document-actions">
                <button class="btn btn-outlined" onclick="openDocument('${id}')">Open</button>
                <button class="btn btn-outlined" onclick="goToQA('${id}')">Q&A</button>
                <button class="btn btn-outlined" onclick="deleteDocument('${id}')">Delete</button>
            </div>
        `;
        list.appendChild(item);

        const option1 = document.createElement('option');
        option1.value = id;
        option1.textContent = doc.name;
        docSelect.appendChild(option1);

        const option2 = option1.cloneNode(true);
        flashcardDocSelect.appendChild(option2);

        const option3 = option1.cloneNode(true);
        notesDocSelect.appendChild(option3);
    }
}

function openDocument(id) {
    const doc = documents[id];
    if (!doc) return;
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

function goToQA(id) {
    showSection('qa-section');
    document.getElementById('doc-select').value = id;
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);

        if (error) throw error;

        delete documents[id];
        stats.documentsUploaded = Math.max(0, stats.documentsUploaded - 1);
        await saveStats();
        loadDocumentList();
        updateStats();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting document');
    }
}

// Q&A Functionality
async function sendQuestion() {
    const input = document.getElementById('chat-input');
    const question = input.value.trim();
    const docId = document.getElementById('doc-select').value;

    if (!question) {
        alert('Please enter a question');
        return;
    }

    if (!docId) {
        alert('Please select a document first');
        return;
    }

    const doc = documents[docId];
    if (!doc) return;

    appendMessage('user', question);
    input.value = '';
    stats.questionsAsked++;
    updateStats();

    const loadingId = 'loading-' + Date.now();
    appendMessage('ai', '<div class="loading"></div>', loadingId);

    try {
        const response = await fetch("${API_BASE_URL}/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: question,
                document: doc.content,
            }),
        });

        removeMessage(loadingId);
        const data = await response.json();
        
        if (data.error) {
            appendMessage('ai', '⚠️ Error: ' + data.error);
            return;
        }

        const answer = data.choices[0].message.content;
        appendMessage('ai', answer);

        // Save to Supabase
        await supabase
            .from('chat_history')
            .insert({
                user_id: currentUser.id,
                document_id: docId,
                question: question,
                answer: answer
            });

        await saveStats();

    } catch (error) {
        removeMessage(loadingId);
        appendMessage('ai', '⚠️ Error: ' + error.message);
        console.error('Error:', error);
    }
}

function appendMessage(sender, text, id) {
    const container = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    if (id) messageDiv.id = id;

    messageDiv.innerHTML = `
        <div class="message-avatar">${sender === 'user' ? 'You' : 'AI'}</div>
        <div class="message-content"><p>${text}</p></div>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function removeMessage(id) {
    const msg = document.getElementById(id);
    if (msg) msg.remove();
}

async function clearChat() {
    if (!confirm('Clear chat history?')) return;
    
    const docId = document.getElementById('doc-select').value;
    if (docId) {
        try {
            await supabase
                .from('chat_history')
                .delete()
                .eq('document_id', docId)
                .eq('user_id', currentUser.id);

            delete chatHistory[docId];
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }
    
    document.getElementById('chat-container').innerHTML = '';
}

// Flashcards
function openFlashcardModal() {
    document.getElementById('flashcard-modal').style.display = 'block';
}

function closeFlashcardModal() {
    document.getElementById('flashcard-modal').style.display = 'none';
}

async function generateFlashcards() {
    const docId = document.getElementById('flashcard-doc-select').value;
    const count = parseInt(document.getElementById('flashcard-count').value);

    if (!docId) {
        alert('Please select a document');
        return;
    }

    const doc = documents[docId];
    if (!doc) return;

    closeFlashcardModal();
    showSection('flashcards-section');

    const display = document.getElementById('flashcard-display');
    display.innerHTML = '<div class="loading" style="margin: 2rem auto;"></div>';

    try {
        const response = await fetch("${API_BASE_URL}/api/flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                document: doc.content,
                count: count,
            }),
        });

        const data = await response.json();
        
        if (data.error) {
            display.innerHTML = '<p>⚠️ Error: ' + data.error + '</p>';
            return;
        }

        let flashcardsText = data.choices[0].message.content;
        const jsonMatch = flashcardsText.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            display.innerHTML = '<p>⚠️ Could not parse flashcards</p>';
            return;
        }
        
        const flashcards = JSON.parse(jsonMatch[0]);
        
        // Save to Supabase
        const { data: setData, error } = await supabase
            .from('flashcard_sets')
            .insert({
                user_id: currentUser.id,
                doc_name: doc.name,
                cards: flashcards
            })
            .select()
            .single();

        if (error) throw error;

        flashcardSets[setData.id] = {
            docName: doc.name,
            cards: flashcards,
            created: setData.created_at
        };
        
        stats.flashcardsCreated += flashcards.length;
        await saveStats();
        updateStats();
        displayFlashcards(setData.id);

    } catch (error) {
        display.innerHTML = '<p>⚠️ Error: ' + error.message + '</p>';
        console.error(error);
    }
}

function displayFlashcards(setId) {
    const set = flashcardSets[setId];
    if (!set || !set.cards.length) return;

    currentFlashcardIndex = 0;
    const display = document.getElementById('flashcard-display');
    
    display.innerHTML = `
        <div class="flashcard" onclick="toggleFlashcard(this)">
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    <h3 id="flashcard-question">${set.cards[0].question}</h3>
                </div>
                <div class="flashcard-back">
                    <p id="flashcard-answer">${set.cards[0].answer}</p>
                </div>
            </div>
        </div>
        <div class="flashcard-actions">
            <button class="btn btn-outlined" onclick="previousFlashcard('${setId}')">Previous</button>
            <span id="flashcard-counter">Card 1 of ${set.cards.length}</span>
            <button class="btn btn-outlined" onclick="nextFlashcard('${setId}')">Next</button>
        </div>
        <div style="text-align: center; margin-top: 1rem;">
            <button class="btn btn-outlined" onclick="deleteFlashcardSet('${setId}')">Delete Set</button>
        </div>
    `;
}

function toggleFlashcard(card) {
    card.classList.toggle('flipped');
}

function nextFlashcard(setId) {
    const set = flashcardSets[setId];
    if (!set) return;
    
    currentFlashcardIndex = (currentFlashcardIndex + 1) % set.cards.length;
    updateFlashcardDisplay(set);
}

function previousFlashcard(setId) {
    const set = flashcardSets[setId];
    if (!set) return;
    
    currentFlashcardIndex = currentFlashcardIndex === 0 ? set.cards.length - 1 : currentFlashcardIndex - 1;
    updateFlashcardDisplay(set);
}

function updateFlashcardDisplay(set) {
    const card = set.cards[currentFlashcardIndex];
    document.getElementById('flashcard-question').textContent = card.question;
    document.getElementById('flashcard-answer').textContent = card.answer;
    document.getElementById('flashcard-counter').textContent = `Card ${currentFlashcardIndex + 1} of ${set.cards.length}`;
    
    const flashcard = document.querySelector('.flashcard');
    if (flashcard && flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');
    }
}

async function deleteFlashcardSet(setId) {
    if (!confirm('Delete this flashcard set?')) return;
    
    try {
        const set = flashcardSets[setId];
        
        await supabase
            .from('flashcard_sets')
            .delete()
            .eq('id', setId);

        if (set) {
            stats.flashcardsCreated = Math.max(0, stats.flashcardsCreated - set.cards.length);
        }
        
        delete flashcardSets[setId];
        await saveStats();
        updateStats();
        document.getElementById('flashcard-display').innerHTML = '<p>Flashcard set deleted.</p>';
    } catch (error) {
        console.error('Error deleting flashcard set:', error);
    }
}

// Notes
function openNotesModal() {
    document.getElementById('notes-modal').style.display = 'block';
}

function closeNotesModal() {
    document.getElementById('notes-modal').style.display = 'none';
}

async function generateNotes() {
    const docId = document.getElementById('notes-doc-select').value;

    if (!docId) {
        alert('Please select a document');
        return;
    }

    const doc = documents[docId];
    if (!doc) return;

    closeNotesModal();
    showSection('notes-section');

    document.getElementById('note-content').value = 'Generating notes...';

    try {
        const response = await fetch("${API_BASE_URL}/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                document: doc.content,
            }),
        });

        const data = await response.json();
        
        if (data.error) {
            document.getElementById('note-content').value = '⚠️ Error: ' + data.error;
            return;
        }

        const notes = data.choices[0].message.content;

        // Save to Supabase
        const { data: noteData, error } = await supabase
            .from('study_notes')
            .insert({
                user_id: currentUser.id,
                title: doc.name + ' - Notes',
                content: notes,
                doc_name: doc.name
            })
            .select()
            .single();

        if (error) throw error;

        studyNotes[noteData.id] = {
            title: noteData.title,
            content: noteData.content,
            created: noteData.created_at,
            docName: noteData.doc_name
        };

        stats.notesCreated++;
        await saveStats();
        updateStats();
        loadNotesList();
        selectNote(noteData.id);

    } catch (error) {
        document.getElementById('note-content').value = '⚠️ Error: ' + error.message;
        console.error(error);
    }
}

function loadNotesList() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    for (let [id, note] of Object.entries(studyNotes)) {
        const item = document.createElement('div');
        item.className = 'note-item';
        if (id === currentNoteId) item.classList.add('active');
        
        const date = new Date(note.created).toLocaleDateString();
        item.innerHTML = `
            <div class="note-title">${note.title}</div>
            <div class="note-date">${date}</div>
        `;
        item.onclick = () => selectNote(id);
        list.appendChild(item);
    }
}

function selectNote(noteId) {
    currentNoteId = noteId;
    const note = studyNotes[noteId];
    if (!note) return;

    document.getElementById('note-content').value = note.content;
    loadNotesList();
}

async function saveNote() {
    if (!currentNoteId) {
        alert('No note selected');
        return;
    }

    const content = document.getElementById('note-content').value;
    
    try {
        await supabase
            .from('study_notes')
            .update({
                content: content,
                modified_at: new Date().toISOString()
            })
            .eq('id', currentNoteId);

        studyNotes[currentNoteId].content = content;
        studyNotes[currentNoteId].modified = new Date().toISOString();
        alert('Note saved!');
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note');
    }
}

function downloadNote() {
    if (!currentNoteId) {
        alert('No note selected');
        return;
    }

    const note = studyNotes[currentNoteId];
    const blob = new Blob([note.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = note.title + '.txt';
    a.click();
    URL.revokeObjectURL(url);
}

async function deleteNote() {
    if (!currentNoteId) {
        alert('No note selected');
        return;
    }

    if (!confirm('Delete this note?')) return;

    try {
        await supabase
            .from('study_notes')
            .delete()
            .eq('id', currentNoteId);

        delete studyNotes[currentNoteId];
        stats.notesCreated = Math.max(0, stats.notesCreated - 1);
        currentNoteId = null;
        document.getElementById('note-content').value = '';
        await saveStats();
        updateStats();
        loadNotesList();
    } catch (error) {
        console.error('Error deleting note:', error);
    }
}

// Question Paper Analyzer
async function analyzeQuestionPapers() {
    if (questionPapers.length === 0) {
        alert("Please upload at least one question paper first!");
        return;
    }

    document.getElementById("qp-analysis-result").innerHTML = "Analyzing... <div class='loading'></div>";

    try {
        const response = await fetch("${API_BASE_URL}/api/analyze-papers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documents: questionPapers }),
        });

        const data = await response.json();

        if (data.error) {
            document.getElementById("qp-analysis-result").innerHTML = "⚠️ " + data.error;
            return;
        }

        qpAnalysisSummary = data.analysis;
        document.getElementById("qp-analysis-result").textContent = data.analysis;
        document.getElementById("download-analysis-btn").style.display = "inline-block";

    } catch (error) {
        document.getElementById("qp-analysis-result").innerHTML = "⚠️ Error: " + error.message;
    }
}

async function sendQPChat() {
    const input = document.getElementById("qp-chat-input");
    const question = input.value.trim();
    if (!question) return;

    appendQPMessage("user", question);
    input.value = "";

    appendQPMessage("ai", "<div class='loading'></div>", "qp-loading");

    try {
        const response = await fetch("${API_BASE_URL}/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: question,
                document: qpAnalysisSummary || questionPapers.join("\n\n"),
            }),
        });

        const data = await response.json();
        removeQPMessage("qp-loading");

        if (data.error) {
            appendQPMessage("ai", "⚠️ " + data.error);
        } else if (data.choices && data.choices[0]) {
            const answer = data.choices[0].message.content;
            appendQPMessage("ai", answer);
        }
    } catch (error) {
        removeQPMessage("qp-loading");
        appendQPMessage("ai", "⚠️ Error: " + error.message);
    }
}

function appendQPMessage(sender, text, id) {
    const container = document.getElementById("qp-chat-container");
    const msg = document.createElement("div");
    msg.className = `message ${sender}-message`;
    if (id) msg.id = id;

    msg.innerHTML = `
        <div class="message-avatar">${sender === "user" ? "You" : "AI"}</div>
        <div class="message-content"><p>${text}</p></div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function removeQPMessage(id) {
    const msg = document.getElementById(id);
    if (msg) msg.remove();
}

function downloadAnalysis() {
    if (!qpAnalysisSummary) {
        alert("No analysis available!");
        return;
    }

    const blob = new Blob([qpAnalysisSummary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Question_Paper_Analysis.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Stats
function updateStats() {
    document.getElementById('stat-docs').textContent = stats.documentsUploaded;
    document.getElementById('stat-flashcards').textContent = stats.flashcardsCreated;
    document.getElementById('stat-notes').textContent = stats.notesCreated;
    document.getElementById('stat-questions').textContent = stats.questionsAsked;
    
    const hours = Math.floor(stats.studyTimeMinutes / 60);
    const minutes = stats.studyTimeMinutes % 60;
    document.getElementById('stat-time').textContent = `${hours}h ${minutes}m`;
    
    const studyGoal = parseInt(document.getElementById('study-goal')?.value || 20);
    const progressPercent = Math.min(100, (hours / studyGoal) * 100);
    document.getElementById('weekly-progress').style.width = progressPercent + '%';
    document.getElementById('study-time-text').textContent = `${hours} hours completed`;
}

function startStudyTimer() {
    studyStartTime = Date.now();
    setInterval(async () => {
        if (studyStartTime && currentUser) {
            const elapsed = Math.floor((Date.now() - studyStartTime) / 60000);
            if (elapsed > 0) {
                stats.studyTimeMinutes += elapsed;
                studyStartTime = Date.now();
                await saveStats();
                updateStats();
            }
        }
    }, 60000);
}

function stopStudyTimer() {
    if (studyStartTime && currentUser) {
        const elapsed = Math.floor((Date.now() - studyStartTime) / 60000);
        stats.studyTimeMinutes += elapsed;
        studyStartTime = null;
    }
}

// Settings
function saveApiKey() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }
    localStorage.setItem('openai_api_key', apiKey);
    window.apiKey = apiKey;
    alert('✅ API key saved successfully!');
}

function saveStudyGoal() {
    const goal = document.getElementById('study-goal').value;
    localStorage.setItem('study_goal', goal);
    alert('Study goal updated to ' + goal + ' hours per week!');
    updateStats();
}

async function exportData() {
    const data = {
        documents,
        chatHistory,
        flashcardSets,
        studyNotes,
        stats
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personalstudy_data.json';
    a.click();
    URL.revokeObjectURL(url);
}

async function clearAllData() {
    if (!confirm('This will delete ALL your data. Are you sure?')) return;
    if (!confirm('Really sure? This cannot be undone!')) return;
    
    try {
        // Delete all user data from Supabase
        await supabase.from('chat_history').delete().eq('user_id', currentUser.id);
        await supabase.from('flashcard_sets').delete().eq('user_id', currentUser.id);
        await supabase.from('study_notes').delete().eq('user_id', currentUser.id);
        await supabase.from('documents').delete().eq('user_id', currentUser.id);
        await supabase.from('user_stats').delete().eq('user_id', currentUser.id);

        // Reset local data
        documents = {};
        chatHistory = {};
        flashcardSets = {};
        studyNotes = {};
        stats = {
            documentsUploaded: 0,
            flashcardsCreated: 0,
            notesCreated: 0,
            questionsAsked: 0,
            studyTimeMinutes: 0,
            flashcardAccuracy: 0
        };
        
        // Recreate stats entry
        await supabase.from('user_stats').insert({
            user_id: currentUser.id
        });

        loadDocumentList();
        loadNotesList();
        updateStats();
        alert('All data cleared!');
    } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    // Load saved API key
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
        window.apiKey = savedKey;
        document.getElementById('api-key').value = savedKey;
    }

    // Load saved study goal
    const savedGoal = localStorage.getItem('study_goal');
    if (savedGoal) {
        document.getElementById('study-goal').value = savedGoal;
    }

    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadData();
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        await loadAccountInfo();
        updateStats();
        loadDocumentList();
        loadNotesList();
        startStudyTimer();
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
        }
    });
    
    // File input handler
    document.getElementById('file-input').addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });
    
    // QP file input handler
    document.getElementById("qp-file-input").addEventListener("change", async (e) => {
        const files = e.target.files;
        const list = document.getElementById("qp-uploaded-list");
        list.innerHTML = "";

        for (let file of files) {
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("${API_BASE_URL}/api/upload", {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();
                questionPapers.push(data.content);

                const item = document.createElement("div");
                item.textContent = "📄 " + data.filename;
                list.appendChild(item);
            } catch (error) {
                console.error("Upload error:", error);
            }
        }

        if (files.length > 0) {
            alert("✅ Uploaded " + files.length + " papers successfully!");
        }
    });
});

// ===== PWA: Service Worker Registration =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('✅ Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.log('❌ Service Worker registration failed:', error);
            });
    });
}

// ===== PWA: Install Prompt =====
let deferredPrompt;
const installButton = document.createElement('button');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default install prompt
    e.preventDefault();
    deferredPrompt = e;
    
    // Show custom install button
    installButton.textContent = '📱 Install App';
    installButton.className = 'btn btn-primary';
    installButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 20px;
        border-radius: 25px;
        box-shadow: 0 4px 12px rgba(67, 97, 238, 0.4);
        animation: pulse 2s infinite;
    `;
    
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        // Show install prompt
        deferredPrompt.prompt();
        
        // Wait for user response
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Install prompt outcome: ${outcome}`);
        
        // Clear prompt
        deferredPrompt = null;
        installButton.remove();
    });
    
    // Only show button after user is logged in
    const checkAuth = setInterval(() => {
        if (currentUser) {
            document.body.appendChild(installButton);
            clearInterval(checkAuth);
        }
    }, 1000);
});

// Remove install button after successful install
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully!');
    installButton.remove();
    deferredPrompt = null;
});

// Add pulse animation for install button
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.05);
        }
    }
`;

document.head.appendChild(style);
