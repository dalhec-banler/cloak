/**
 * Cloak Content Script
 *
 * Injected into all pages. Detects signup/login/verification
 * forms and handles autofill when instructed by the background
 * script or popup.
 */

// --- Form Detection ---

function findForms() {
  const forms = [];

  // Find all forms on the page
  const formElements = document.querySelectorAll('form');
  for (const form of formElements) {
    const info = analyzeForm(form);
    if (info) forms.push(info);
  }

  // Also check for implicit forms (inputs not inside a <form>)
  const orphanInputs = findOrphanInputs();
  if (orphanInputs) forms.push(orphanInputs);

  return forms;
}

function analyzeForm(form) {
  const emailInputs = form.querySelectorAll(
    'input[type="email"], input[name*="email" i], input[autocomplete="email"]'
  );
  const passwordInputs = form.querySelectorAll(
    'input[type="password"]'
  );
  const usernameInputs = form.querySelectorAll(
    'input[name*="user" i], input[autocomplete="username"], input[type="text"][name*="login" i]'
  );
  const codeInputs = form.querySelectorAll(
    'input[name*="code" i], input[name*="otp" i], input[name*="verify" i], input[autocomplete="one-time-code"]'
  );

  if (emailInputs.length === 0 && usernameInputs.length === 0 && codeInputs.length === 0) {
    return null;
  }

  // Determine form type
  let type = 'unknown';
  if (codeInputs.length > 0) {
    type = 'verification';
  } else if (passwordInputs.length >= 2) {
    type = 'signup'; // password + confirm password
  } else if (passwordInputs.length === 1 && emailInputs.length > 0) {
    // Check for signup indicators
    const formText = form.textContent.toLowerCase();
    const isSignup =
      formText.includes('sign up') ||
      formText.includes('register') ||
      formText.includes('create account') ||
      formText.includes('join') ||
      form.querySelector('input[name*="name" i]:not([name*="user" i])');
    type = isSignup ? 'signup' : 'login';
  } else if (passwordInputs.length === 1) {
    type = 'login';
  }

  return {
    type,
    element: form,
    emailInput: emailInputs[0] || null,
    usernameInput: usernameInputs[0] || null,
    passwordInputs: Array.from(passwordInputs),
    codeInput: codeInputs[0] || null,
  };
}

function findOrphanInputs() {
  const allInputs = document.querySelectorAll('input');
  const orphans = Array.from(allInputs).filter(
    (input) => !input.closest('form')
  );

  if (orphans.length === 0) return null;

  const emailInputs = orphans.filter(
    (i) =>
      i.type === 'email' ||
      i.name?.toLowerCase().includes('email') ||
      i.autocomplete === 'email'
  );
  const passwordInputs = orphans.filter((i) => i.type === 'password');
  const codeInputs = orphans.filter(
    (i) =>
      i.name?.toLowerCase().includes('code') ||
      i.name?.toLowerCase().includes('otp') ||
      i.autocomplete === 'one-time-code'
  );

  if (emailInputs.length === 0 && passwordInputs.length === 0 && codeInputs.length === 0) {
    return null;
  }

  let type = 'unknown';
  if (codeInputs.length > 0) type = 'verification';
  else if (passwordInputs.length > 0 && emailInputs.length > 0) type = 'login';

  return {
    type,
    element: document.body,
    emailInput: emailInputs[0] || null,
    usernameInput: null,
    passwordInputs,
    codeInput: codeInputs[0] || null,
  };
}

// --- Autofill ---

function fillInput(input, value) {
  if (!input || !value) return;

  // Focus the input
  input.focus();

  // Set value using native setter to trigger React/Vue/Angular change detection
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }

  // Dispatch events to notify frameworks
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

function fillForm(username, password) {
  const forms = findForms();
  if (forms.length === 0) return false;

  const form = forms[0]; // use first detected form

  // Fill email/username
  if (form.emailInput) {
    fillInput(form.emailInput, username);
  } else if (form.usernameInput) {
    fillInput(form.usernameInput, username);
  }

  // Fill password(s)
  for (const passInput of form.passwordInputs) {
    fillInput(passInput, password);
  }

  return true;
}

function fillCode(code) {
  const forms = findForms();
  const verifyForm = forms.find((f) => f.type === 'verification');

  if (verifyForm?.codeInput) {
    fillInput(verifyForm.codeInput, code);
    return true;
  }

  // Handle split-digit code inputs (e.g., 6 separate single-char inputs)
  const digitInputs = document.querySelectorAll(
    'input[maxlength="1"], input[data-index]'
  );
  if (digitInputs.length >= 4 && digitInputs.length <= 8 && code.length === digitInputs.length) {
    for (let i = 0; i < code.length; i++) {
      fillInput(digitInputs[i], code[i]);
    }
    return true;
  }

  return false;
}

// --- Message handler ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'detectForms': {
      const forms = findForms();
      sendResponse({
        forms: forms.map((f) => ({
          type: f.type,
          hasEmail: !!f.emailInput,
          hasPassword: f.passwordInputs.length > 0,
          hasCode: !!f.codeInput,
        })),
      });
      break;
    }

    case 'fillForm': {
      const ok = fillForm(msg.username, msg.password);
      sendResponse({ ok });
      break;
    }

    case 'fillCode': {
      const ok = fillCode(msg.code);
      sendResponse({ ok });
      break;
    }

    case 'getPageInfo': {
      sendResponse({
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
      });
      break;
    }
  }

  return true;
});

// --- Notify background about page forms on load ---

const forms = findForms();
if (forms.length > 0) {
  chrome.runtime.sendMessage({
    type: 'formsDetected',
    domain: window.location.hostname,
    forms: forms.map((f) => ({
      type: f.type,
      hasEmail: !!f.emailInput,
      hasPassword: f.passwordInputs.length > 0,
      hasCode: !!f.codeInput,
    })),
  });
}
