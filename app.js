let GROQ_KEY = '';

function init() {
  const saved = sessionStorage.getItem('groq_key');
  if (saved) {
    GROQ_KEY = saved;
  } else {
    showKeyModal();
  }
}

function showKeyModal() {
  document.getElementById('key-modal').classList.remove('hidden');
}

function saveKey() {
  const key = document.getElementById('key-input').value.trim();
if (!key) {
    alert('Please enter a valid Groq API key. It should start with gsk_');
    return;
  }
  GROQ_KEY = key;
  sessionStorage.setItem('groq_key', key);
  document.getElementById('key-modal').classList.add('hidden');
}

function changeKey() {
  sessionStorage.removeItem('groq_key');
  GROQ_KEY = '';
  document.getElementById('key-input').value = '';
  showKeyModal();
}

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
}

async function groq(prompt) {
  if (!GROQ_KEY) {
    showKeyModal();
    throw new Error('No API key found. Please enter your Groq API key.');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  if (data.error) {
    if (data.error.code === 'invalid_api_key') {
      sessionStorage.removeItem('groq_key');
      GROQ_KEY = '';
      showKeyModal();
      throw new Error('Invalid API key. Please check and try again.');
    }
    throw new Error(data.error.message || 'API error');
  }
  if (!data.choices?.[0]) throw new Error('No response from API');
  return data.choices[0].message.content;
}

function copyText(id) {
  navigator.clipboard.writeText(document.getElementById(id).textContent);
  event.target.textContent = 'Copied!';
  setTimeout(() => event.target.textContent = 'Copy', 1500);
}

function setLoading(section, on) {
  const map = {
    resume: 'resume-loading',
    cover: 'cover-loading',
    li: 'li-loading',
    skills: 'skills-loading'
  };
  document.getElementById(map[section]).classList.toggle('hidden', !on);
}

async function analyzeResume() {
  const resume = document.getElementById('resume').value.trim();
  const jd = document.getElementById('jobdesc').value.trim();
  if (!resume || !jd) return alert('Please fill in both fields.');

  setLoading('resume', true);
  document.getElementById('resume-results').classList.add('hidden');

  try {
    const text = await groq(
      `You are an expert ATS Resume Analyzer.
Resume: ${resume}
Job Description: ${jd}
Provide:
1. ATS Score out of 100
2. Missing keywords
3. What to add
4. What to improve
5. Overall recommendation
Be specific.`
    );

    const scoreMatch = text.match(/(\d+)\s*(?:out of|\/)\s*100/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const level = score >= 80 ? 'Strong' : score >= 60 ? 'Good' : 'Weak';
    const cls = score >= 80 ? 'score-strong' : score >= 60 ? 'score-mid' : 'score-weak';

    document.getElementById('ats-score').textContent = score || '?';
    document.getElementById('match-level').textContent = level;
    document.getElementById('missing-count').textContent = (text.match(/\d+\./g) || []).length;
    document.getElementById('score-card-match').className = 'score-card ' + cls;
    document.getElementById('resume-feedback').textContent = text;
    document.getElementById('resume-results').classList.remove('hidden');
  } catch (e) {
    alert('Error: ' + e.message);
  }
  setLoading('resume', false);
}

function resetResume() {
  document.getElementById('resume').value = '';
  document.getElementById('jobdesc').value = '';
  document.getElementById('resume-results').classList.add('hidden');
  document.getElementById('ats-score').textContent = '—';
  document.getElementById('match-level').textContent = '—';
  document.getElementById('missing-count').textContent = '—';
  document.getElementById('resume-feedback').textContent = '';
}

let currentRole = 'AI Engineer';
let questions = [];
let questionIndex = 0;
let totalScore = 0;
let interviewActive = false;

function selectRole(btn, r) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentRole = r;
  document.getElementById('role-label').textContent = r;
}

function addMessage(type, html) {
  const startScreen = document.getElementById('start-screen');
  if (startScreen) startScreen.remove();

  const msgs = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'msg-row ' + type;
  const avatar = type === 'bot' ? '🤖' : '👤';
  div.innerHTML = `<div class="msg-av ${type}">${avatar}</div><div class="msg-bub">${html}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addFeedbackMessage(text) {
  const msgs = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'feedback-pill';
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

async function startInterview() {
  interviewActive = true;
  questionIndex = 0;
  totalScore = 0;
  questions = [];

  document.getElementById('answer-input').disabled = false;
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('total-score').innerHTML = '0<span style="font-size:14px;color:var(--text3);">/50</span>';
  document.getElementById('score-label').textContent = 'In progress';
  updateProgress();

  addMessage('bot', `Welcome! I will be your AI interviewer for <strong>${currentRole}</strong>. I will ask 5 questions and score each answer. Ready? Let us go!`);
  addMessage('bot', 'Preparing your questions...');

  try {
    const text = await groq(
      `Generate exactly 5 interview questions for ${currentRole} role. Return ONLY a numbered list:
1. ...
2. ...
3. ...
4. ...
5. ...`
    );

    questions = text
      .split('\n')
      .filter(l => l.match(/^\d+\./))
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 5);

    document.getElementById('chat-msgs').lastChild.remove();
    askNextQuestion();
  } catch (e) {
    addMessage('bot', 'Error: ' + e.message);
  }
}

function askNextQuestion() {
  if (questionIndex >= 5) {
    endInterview();
    return;
  }
  updateProgress();
  addMessage('bot', `<strong>Question ${questionIndex + 1} of 5:</strong> ${questions[questionIndex]}`);
}

async function submitAnswer() {
  const input = document.getElementById('answer-input');
  const answer = input.value.trim();
  if (!answer || !interviewActive) return;

  if (answer.length < 20) {
    alert('Please give a proper answer — at least one full sentence!');
    return;
  }

  input.value = '';
  input.disabled = true;
  document.getElementById('submit-btn').disabled = true;

  addMessage('user', answer);
  addMessage('bot', 'Evaluating your answer...');

  try {
    const feedback = await groq(
      `Interview evaluator for ${currentRole}.
Question: ${questions[questionIndex]}
Answer: ${answer}
Give: Score out of 10 strictly based on answer quality. If answer is irrelevant, too short, or gibberish give 0. Start with "Score: X/10". Be concise, strict but encouraging.`
    );

    document.getElementById('chat-msgs').lastChild.remove();
    addFeedbackMessage(feedback);

    const match = feedback.match(/score[:\s]+(\d+)/i);
    const points = match ? parseInt(match[1]) : 5;
    totalScore += points;

    document.getElementById('total-score').innerHTML = `${totalScore}<span style="font-size:14px;color:var(--text3);">/50</span>`;
    questionIndex++;
    updateProgress();

    setTimeout(() => {
      input.disabled = false;
      document.getElementById('submit-btn').disabled = false;
      askNextQuestion();
      input.focus();
    }, 800);
  } catch (e) {
    addMessage('bot', 'Error: ' + e.message);
    input.disabled = false;
    document.getElementById('submit-btn').disabled = false;
  }
}

function updateProgress() {
  const percent = Math.round((questionIndex / 5) * 100);
  document.getElementById('q-progress').textContent = `${questionIndex} of 5 questions`;
  document.getElementById('q-pill').textContent = `Q${Math.min(questionIndex + 1, 5)} of 5`;
  document.getElementById('progress-fill').style.width = percent + '%';
}

function endInterview() {
  interviewActive = false;
  document.getElementById('answer-input').disabled = true;
  document.getElementById('submit-btn').disabled = true;

  const percent = Math.round((totalScore / 50) * 100);
  const level = percent >= 80 ? 'Excellent' : percent >= 60 ? 'Good' : 'Needs Practice';
  document.getElementById('score-label').textContent = level;
  document.getElementById('q-pill').textContent = 'Complete';

  const message = percent >= 80
    ? 'You are ready for real interviews!'
    : percent >= 60
    ? 'Good effort — keep practising!'
    : 'Keep learning — you will get there!';

  addMessage('bot', `Interview complete! Final score: <strong>${totalScore}/50 (${percent}%)</strong> — ${level}. ${message}`);

  const msgs = document.getElementById('chat-msgs');
  const restartDiv = document.createElement('div');
  restartDiv.style.cssText = 'text-align:center; margin-top:16px;';
  restartDiv.innerHTML = `<button class="btn-primary" onclick="restartInterview()">Try Again</button>`;
  msgs.appendChild(restartDiv);
  msgs.scrollTop = msgs.scrollHeight;
}

function restartInterview() {
  interviewActive = false;
  questionIndex = 0;
  totalScore = 0;
  questions = [];

  document.getElementById('chat-msgs').innerHTML = `
    <div class="start-empty" id="start-screen">
      <div class="emoji">🎯</div>
      <h3>Ready for your interview?</h3>
      <p>Select a role and click Start to begin your AI-powered mock session.</p>
      <button class="btn-primary" style="margin-top:8px;" onclick="startInterview()">Start Interview</button>
    </div>`;

  document.getElementById('total-score').innerHTML = '0<span style="font-size:14px;color:var(--text3);">/50</span>';
  document.getElementById('score-label').textContent = 'Not started';
  document.getElementById('q-progress').textContent = '0 of 5 questions';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('q-pill').textContent = 'Ready to start';
  document.getElementById('answer-input').disabled = true;
  document.getElementById('submit-btn').disabled = true;
}

async function generateCover() {
  const name = document.getElementById('cv-name').value.trim();
  const role = document.getElementById('cv-role').value.trim();
  const company = document.getElementById('cv-company').value.trim();
  const skills = document.getElementById('cv-skills').value.trim();
  const jd = document.getElementById('cv-jd').value.trim();

  if (!name || !role || !company || !skills) return alert('Please fill in all required fields.');

  setLoading('cover', true);
  document.getElementById('cover-result').classList.add('hidden');

  try {
    const text = await groq(
      `Write a professional cover letter for:
Name: ${name}
Role: ${role}
Company: ${company}
Skills and Experience: ${skills}
${jd ? 'Job Description: ' + jd : ''}
Write a genuine, specific, professional cover letter. 3 to 4 paragraphs. No placeholder brackets.`
    );
    document.getElementById('cover-output').textContent = text;
    document.getElementById('cover-result').classList.remove('hidden');
  } catch (e) {
    alert('Error: ' + e.message);
  }
  setLoading('cover', false);
}

function resetCover() {
  document.getElementById('cv-name').value = '';
  document.getElementById('cv-role').value = '';
  document.getElementById('cv-company').value = '';
  document.getElementById('cv-skills').value = '';
  document.getElementById('cv-jd').value = '';
  document.getElementById('cover-result').classList.add('hidden');
  document.getElementById('cover-output').textContent = '';
}

async function generateLinkedIn() {
  const name = document.getElementById('li-name').value.trim();
  const role = document.getElementById('li-role').value.trim();
  const edu = document.getElementById('li-edu').value.trim();
  const skills = document.getElementById('li-skills').value.trim();
  const exp = document.getElementById('li-exp').value.trim();

  if (!name || !role) return alert('Please fill in at least your name and target role.');

  setLoading('li', true);
  document.getElementById('li-results').classList.add('hidden');

  try {
    const text = await groq(
      `Create LinkedIn profile content for:
Name: ${name}
Target Role: ${role}
Education: ${edu}
Skills: ${skills}
Experience: ${exp}

Return TWO sections separated by ---
Section 1: LinkedIn headline (max 220 characters, keyword rich)
Section 2: About section (3 to 4 paragraphs, professional but genuine, ends with open to opportunities)

Return only the content, no section labels.`
    );

    const parts = text.split('---');
    document.getElementById('li-headline').textContent = (parts[0] || text).trim();
    document.getElementById('li-about').textContent = (parts[1] || '').trim();
    document.getElementById('li-results').classList.remove('hidden');
  } catch (e) {
    alert('Error: ' + e.message);
  }
  setLoading('li', false);
}

function resetLinkedIn() {
  document.getElementById('li-name').value = '';
  document.getElementById('li-role').value = '';
  document.getElementById('li-edu').value = '';
  document.getElementById('li-skills').value = '';
  document.getElementById('li-exp').value = '';
  document.getElementById('li-results').classList.add('hidden');
  document.getElementById('li-headline').textContent = '';
  document.getElementById('li-about').textContent = '';
}

async function analyzeSkills() {
  const mySkills = document.getElementById('sg-skills').value.trim();
  const targetRole = document.getElementById('sg-role').value.trim();
  const level = document.getElementById('sg-level').value;

  if (!mySkills || !targetRole) return alert('Please fill in your skills and target role.');

  setLoading('skills', true);
  document.getElementById('skills-results').classList.add('hidden');

  try {
    const text = await groq(
      `Skills gap analysis:
Current skills: ${mySkills}
Target role: ${targetRole}
Level: ${level}

Return in this exact format:
HAVE: skill1, skill2, skill3
MISSING: skill1, skill2, skill3
ROADMAP:
numbered learning roadmap with timeframes`
    );

    const haveMatch = text.match(/HAVE:(.*?)(?:MISSING:|$)/is);
    const missingMatch = text.match(/MISSING:(.*?)(?:ROADMAP:|$)/is);
    const roadmapMatch = text.match(/ROADMAP:(.*?)$/is);

    const haveSkills = haveMatch ? haveMatch[1].trim().split(',').map(s => s.trim()).filter(Boolean) : [];
    const missingSkills = missingMatch ? missingMatch[1].trim().split(',').map(s => s.trim()).filter(Boolean) : [];
    const roadmap = roadmapMatch ? roadmapMatch[1].trim() : text;

    document.getElementById('skills-have').innerHTML = haveSkills.map(s => `<span class="tag tag-green">${s}</span>`).join('');
    document.getElementById('skills-missing').innerHTML = missingSkills.map(s => `<span class="tag tag-red">${s}</span>`).join('');
    document.getElementById('skills-roadmap').textContent = roadmap;
    document.getElementById('skills-results').classList.remove('hidden');
  } catch (e) {
    alert('Error: ' + e.message);
  }
  setLoading('skills', false);
}

function resetSkills() {
  document.getElementById('sg-skills').value = '';
  document.getElementById('sg-role').value = '';
  document.getElementById('sg-level').value = 'fresher';
  document.getElementById('skills-results').classList.add('hidden');
  document.getElementById('skills-have').innerHTML = '';
  document.getElementById('skills-missing').innerHTML = '';
  document.getElementById('skills-roadmap').textContent = '';
}

window.onload = init;
