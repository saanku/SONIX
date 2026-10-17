import './auth-screen.css';

export function createAuthScreen({getClient,onSignedIn}) {
  const root=document.querySelector('#auth-root');
  let mode='signin',busy=false,resendAfter=0;
  root.innerHTML=`<div class="auth-shell"><section class="auth-story" aria-label="Welcome to sanku inte lokham">
    <a class="auth-brand" href="#home"><img src="${import.meta.env.BASE_URL}icon.svg" alt=""/><b class="brand-name">sanku inte lokham</b><span>YOUR WORLD, ON REPEAT</span></a>
    <div class="auth-story-copy"><span class="auth-kicker">A SPACE THAT SOUNDS LIKE YOU</span><h2>Less noise.<br/>More <em>you.</em></h2><p>Your favorite songs. Your late-night playlists.<br/>A little world you can come back to.</p>
    <div class="auth-art" aria-hidden="true"><img src="${import.meta.env.BASE_URL}art/night.jpg" alt=""/><div class="auth-art-caption"><span>YOUR NEXT FAVORITE AWAITS</span><strong>Find your flow.</strong><div class="auth-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div></div>
    <p class="auth-story-footer">Your playlists, saved. Your music, always yours.</p></section>
    <section class="auth-form-side"><div class="auth-card"><span class="auth-kicker">YOUR PERSONAL MUSIC SPACE</span><h1 id="auth-title">Welcome back.</h1><p id="auth-intro">Sign in to pick up where you left off.</p>
    <div class="auth-tabs" role="group" aria-label="Account options"><button type="button" data-auth-mode="signin" aria-pressed="true">Sign in</button><button type="button" data-auth-mode="signup" aria-pressed="false">Create account</button></div>
    <form id="entry-form"><div id="signup-name" hidden><label for="entry-name">Your name</label><input id="entry-name" name="name" autocomplete="name" maxlength="80" placeholder="What should we call you?"/></div>
    <label for="entry-email">Email address</label><input id="entry-email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required placeholder="you@example.com"/>
    <div id="password-fields"><label for="entry-password">Password</label><div class="auth-password"><input id="entry-password" name="password" type="password" autocomplete="current-password" required placeholder="Enter your password"/><button type="button" id="show-password" aria-label="Show password" aria-pressed="false">Show</button></div></div>
    <div id="signup-confirm" hidden><label for="entry-confirm">Confirm password</label><input id="entry-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Enter your password again"/><p class="auth-password-help">Use at least 8 characters.</p></div>
    <p id="entry-message" role="status" aria-live="polite"></p><button class="auth-submit" type="submit" disabled>Opening your music…</button></form>
    <p class="auth-switch">New to sanku inte lokham? <button type="button" data-auth-mode="signup">Create an account</button></p>
    <p class="auth-switch" id="forgot-link"><button type="button" data-auth-mode="forgot">Forgot password?</button></p><div id="confirmation-help" hidden><p>Waiting for your account confirmation?</p><button type="button" id="resend-confirmation">Resend confirmation email</button><p class="confirmation-hint">Check Spam or Junk too. Sign-in uses your email and password; it does not send a login email.</p></div>
    <div class="auth-save-note"><span aria-hidden="true">✓</span><p>Your favorites and playlists are saved to your account. Your imported audio stays on this device.</p></div>
    </div><p class="auth-footnote">A little less noise. A little more music.</p></section></div>`;
  const form=root.querySelector('#entry-form'),message=root.querySelector('#entry-message'),submit=form.querySelector('[type="submit"]');
  function notify(text,error=false){message.textContent=text;message.classList.toggle('error',error);}
  function updateResend(){const button=root.querySelector('#resend-confirmation'),seconds=Math.max(0,Math.ceil((resendAfter-Date.now())/1000));button.disabled=busy||seconds>0;button.textContent=seconds?`Resend available in ${seconds}s`:'Resend confirmation email';}
  function setBusy(value,label){busy=value;form.setAttribute('aria-busy',String(value));root.querySelectorAll('button,input').forEach(el=>el.disabled=value);submit.textContent=label||({signup:'Create my account',forgot:'Send reset link',reset:'Save new password'}[mode]||'Sign in');updateResend();}
  function authError(error){
    if(error.code==='email_not_confirmed'||/email not confirmed/i.test(error.message||'')){root.querySelector('#confirmation-help').hidden=false;return 'Confirm your email before signing in. Check Spam or Junk, or use Resend confirmation email below.';}
    if(error.status===429||error.code==='over_email_send_rate_limit')return 'Too many email requests. Wait a few minutes before trying again. The project may have reached its email sending limit.';
    if(error.code==='email_address_not_authorized'||/email address not authorized/i.test(error.message||''))return 'The email service cannot send to this address. The sanku inte lokham owner needs to configure email delivery in Supabase.';
    if(/error sending (confirmation|recovery|email)|smtp/i.test(error.message||''))return 'The email could not be sent. The sanku inte lokham owner needs to check the Supabase email service and delivery logs.';
    return error.message||'Could not sign in. Check your connection and try again.';
  }
  function show(next='signin',text=''){
    mode=next;root.hidden=false;document.querySelector('#app').hidden=true;
    const signup=mode==='signup',reset=mode==='reset',forgot=mode==='forgot';
    root.querySelector('#auth-title').textContent=reset?'Set a new password.':forgot?'Forgot your password?':signup?'Make yourself at home.':'Welcome back.';
    root.querySelector('#auth-intro').textContent=reset?'Choose a new password for your account.':forgot?'Enter your account email to receive a password reset link.':signup?'Create your account. Start your own soundtrack.':'Sign in to pick up where you left off.';
    root.querySelector('#signup-name').hidden=!signup;root.querySelector('#entry-name').required=signup;
    root.querySelector('#signup-confirm').hidden=!(signup||reset);root.querySelector('#entry-confirm').required=signup||reset;
    root.querySelector('#confirmation-help').hidden=true;
    root.querySelector('#forgot-link').hidden=mode!=='signin';
    root.querySelector('.auth-tabs').hidden=reset;
    root.querySelector('#password-fields').hidden=forgot;
    const email=root.querySelector('#entry-email');email.hidden=reset;email.required=!reset;root.querySelector('label[for=entry-email]').hidden=reset;
    const password=root.querySelector('#entry-password');password.required=!forgot;password.autocomplete=signup||reset?'new-password':'current-password';password.minLength=signup||reset?8:1;
    root.querySelectorAll('.auth-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===mode)));
    root.querySelector('.auth-switch').innerHTML=signup||forgot||reset?'Already have an account? <button type="button" data-auth-mode="signin">Sign in</button>':'New to sanku inte lokham? <button type="button" data-auth-mode="signup">Create an account</button>';
    setBusy(false);notify(text);window.scrollTo(0,0);
  }
  root.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button||busy)return;
    if(button.dataset.authMode){show(button.dataset.authMode);return;}
    if(button.id==='resend-confirmation'){
      if(Date.now()<resendAfter)return;
      const field=root.querySelector('#entry-email');field.value=field.value.trim();if(!field.reportValidity()){field.focus();return;}
      setBusy(true,'Requesting confirmation…');notify('');
      try{const client=await getClient();if(!client)throw Error('Account sign-in is not configured yet. Please try again later.');const {error}=await client.auth.resend({type:'signup',email:field.value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;resendAfter=Date.now()+60000;notify('Confirmation requested. If this account needs verification, check your inbox and Spam or Junk folder. If nothing arrives, the sanku inte lokham owner needs to check email delivery.');}
      catch(error){if(error.status===429||error.code==='over_email_send_rate_limit')resendAfter=Date.now()+60000;notify(authError(error),true);}
      finally{setBusy(false);}return;
    }
    if(button.id==='show-password'){const field=root.querySelector('#entry-password'),visible=field.type==='password';field.type=visible?'text':'password';button.textContent=visible?'Hide':'Show';button.setAttribute('aria-label',visible?'Hide password':'Show password');button.setAttribute('aria-pressed',String(visible));}
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const values=new FormData(form),email=String(values.get('email')).trim(),password=String(values.get('password'));
    if((mode==='signup'||mode==='reset')&&password!==values.get('confirm')){notify('Your passwords do not match.',true);root.querySelector('#entry-confirm').focus();return;}
    setBusy(true,mode==='signup'?'Creating your account…':'Signing in…');notify('');
    try{
      const client=await getClient();if(!client)throw Error('Account sign-in is not configured yet. Please try again later.');
      if(mode==='forgot'){
        if(Date.now()<resendAfter){notify('Wait a minute before requesting another email.',true);return;}
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
        if(error){if(error.status===429)resendAfter=Date.now()+60000;throw error;}
        resendAfter=Date.now()+60000;notify('If an account exists for this email, you will receive a password reset link. Check Spam or Junk too.');return;
      }
      if(mode==='reset'){
        const {error}=await client.auth.updateUser({password});if(error)throw error;
        form.reset();const {data}=await client.auth.getSession();await onSignedIn(data.session);return;
      }
      const result=mode==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:{display_name:String(values.get('name')).trim()}}}):await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      form.querySelectorAll('input[type="password"]').forEach(input=>input.value='');root.querySelector('#entry-password').value='';
      if(result.data.session){await onSignedIn(result.data.session);}
      else show('signin','Check your email for the confirmation link, then return here to sign in.');
    }catch(error){notify(authError(error),true);}
    finally{setBusy(false);}
  });
  setInterval(updateResend,1000);
  return {show,hide(){root.hidden=true;document.querySelector('#app').hidden=false;},loading(text='Opening your music…'){root.hidden=false;document.querySelector('#app').hidden=true;setBusy(true,text);notify('');},error(text){show('signin');notify(text,true);}};
}
