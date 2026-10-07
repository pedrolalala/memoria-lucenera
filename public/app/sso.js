/*
 * SPEC-129 — Login único (SSO) com a Central Lucenera.
 *
 * A Central manda o usuário para "/" com ?sso_code=<uuid> (ver
 * src/lib/cross-system-auth.ts no repo da Central). Aqui trocamos esse código
 * por uma sessão Supabase, usando a Edge Function `exchange-cross-system-code`
 * do MESMO projeto Supabase, e recarregamos a página sem o parâmetro. O
 * supabase-adapter.js então encontra a sessão persistida e abre o app.
 *
 * Sem sso_code, este arquivo não faz nada — o login por e-mail/senha e o modo
 * demonstração seguem funcionando normalmente.
 */
;(function () {
  var params = new URLSearchParams(window.location.search)
  var code = params.get('sso_code')
  if (!code) return

  // Cobre a tela de login enquanto a troca acontece, para não piscar o formulário.
  function showOverlay() {
    if (document.getElementById('sso-loading')) return
    var el = document.createElement('div')
    el.id = 'sso-loading'
    el.textContent = 'Entrando…'
    el.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
        'background:#f7f3ec;color:#3e3a36;font:600 18px/1.4 "DM Sans",system-ui,sans-serif',
    )
    ;(document.body || document.documentElement).appendChild(el)
  }
  if (document.body) showOverlay()
  else document.addEventListener('DOMContentLoaded', showOverlay)

  function cleanUrlAndReload() {
    params.delete('sso_code')
    var qs = params.toString()
    window.location.replace(window.location.pathname + (qs ? '?' + qs : ''))
  }

  ;(async function () {
    try {
      var cfg = window.MEMORIA_CONFIG || {}
      if (!cfg.supabaseUrl || !cfg.supabasePublishableKey || !window.supabase) {
        cleanUrlAndReload()
        return
      }
      var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)
      var res = await client.functions.invoke('exchange-cross-system-code', {
        body: { code: code, sistema_destino: 'memoria' },
      })
      var data = res && res.data
      if (data && data.access_token && data.refresh_token) {
        await client.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
      } else if (data && data.token_hash) {
        await client.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' })
      } else {
        console.error('[memoria] SSO: resposta sem sessão', res && res.error)
      }
    } catch (err) {
      console.error('[memoria] SSO falhou', err)
    }
    cleanUrlAndReload()
  })()
})()
