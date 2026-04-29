/-  *cloak
|%
::  generate a random @uvH from entropy
::
++  make-id
  |=  eny=@uvJ
  ^-  @uvH
  `@uvH`(sham eny)
::
::  generate a service-prefixed alias address
::  e.g. "yt-a8f3k2@domain.com"
::
++  make-alias-address
  |=  [service=@t domain=@t eny=@uvJ]
  ^-  @t
  =/  prefix=tape  (scag 3 (trip service))
  =/  rand=@  (sham eny)
  =/  chars=tape  "abcdefghijklmnopqrstuvwxyz0123456789"
  =/  suffix=tape
    =/  i  0
    =/  out=tape  ~
    |-
    ?:  =(i 6)  out
    =/  idx=@  (mod (rsh [3 i] rand) 36)
    $(i +(i), out (snoc out (snag idx chars)))
  (crip (weld prefix (weld "-" (weld suffix (weld "@" (trip domain))))))
::
::  generate a strong random password (24 chars)
::
++  make-password
  |=  eny=@uvJ
  ^-  @t
  =/  chars=tape
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*"
  =/  len=@  (lent chars)
  =/  rand=@  (sham eny)
  =/  i  0
  =/  out=tape  ~
  |-
  ?:  =(i 24)  (crip out)
  =/  idx=@  (mod (rsh [3 i] rand) len)
  $(i +(i), out (snoc out (snag idx chars)))
::
::  build Cloudflare API auth headers
::
++  cf-headers
  |=  tok=@t
  ^-  (list [key=@t value=@t])
  :~  ['authorization' (cat 3 'Bearer ' tok)]
      ['content-type' 'application/json']
  ==
::
::  extract zone ID from CF /zones response
::  response: {"result": [{"id": "abc123", ...}], ...}
::
++  get-zone-id
  |=  jon=json
  ^-  (unit @t)
  ?.  ?=(%o -.jon)  ~
  =/  result  (~(get by p.jon) 'result')
  ?~  result  ~
  ?.  ?=(%a -.u.result)  ~
  ?~  p.u.result  ~
  =/  first=json  i.p.u.result
  ?.  ?=(%o -.first)  ~
  =/  zid  (~(get by p.first) 'id')
  ?~  zid  ~
  ?.  ?=(%s -.u.zid)  ~
  `p.u.zid
::
::  extract result.id from CF API response
::  response: {"result": {"id": "abc123"}, ...}
::
++  get-result-id
  |=  jon=json
  ^-  (unit @t)
  ?.  ?=(%o -.jon)  ~
  =/  result  (~(get by p.jon) 'result')
  ?~  result  ~
  ?.  ?=(%o -.u.result)  ~
  =/  rid  (~(get by p.u.result) 'id')
  ?~  rid  ~
  ?.  ?=(%s -.u.rid)  ~
  `p.u.rid
::
::  extract JSON body from an iris HTTP response sign
::  takes raw sign-arvo, returns parsed json or ~
::
++  extract-iris-json
  |=  sa=sign-arvo
  ^-  (unit json)
  ?.  ?=([%iris %http-response *] sa)  ~
  =/  =client-response:iris  +.+.sa
  ?.  ?=(%finished -.client-response)  ~
  ?~  full-file.client-response  ~
  =/  file  u.full-file.client-response
  =/  bod=@t  `@t`+.+.file
  (de:json:html bod)
::
::  JSON serialization helpers
::
++  enjs
  =,  enjs:format
  |%
  ++  identity
    |=  ci=cloaked-identity
    ^-  json
    %-  pairs
    :~  ['id' s+(scot %uv id.ci)]
        ['service' (sect service.ci)]
        ['label' (sect label.ci)]
        ['status' (sect ?:(?=(%active status.ci) 'active' 'burned'))]
        ['aliasId' s+(scot %uv alias-id.ci)]
        ['credId' s+(scot %uv cred-id.ci)]
        ['created' (sect (scot %da created.ci))]
        ['burned' ?~(burned.ci ~ (sect (scot %da u.burned.ci)))]
    ==
  ::
  ++  ali
    |=  a=alias
    ^-  json
    %-  pairs
    :~  ['id' s+(scot %uv id.a)]
        ['address' (sect address.a)]
        ['identityId' s+(scot %uv identity-id.a)]
        ['service' (sect service.a)]
        ['status' (sect ?:(?=(%active status.a) 'active' 'burned'))]
    ==
  ::
  ++  cred
    |=  c=credential
    ^-  json
    %-  pairs
    :~  ['id' s+(scot %uv id.c)]
        ['identityId' s+(scot %uv identity-id.c)]
        ['username' (sect username.c)]
        ['password' (sect password.c)]
        ['created' (sect (scot %da created.c))]
    ==
  ::
  ++  token
    |=  t=api-token
    ^-  json
    %-  pairs
    :~  ['id' s+(scot %uv id.t)]
        ['token' (sect token.t)]
        ['label' (sect label.t)]
        ['created' (sect (scot %da created.t))]
        ['lastUsed' (sect (scot %da last-used.t))]
    ==
  ::
  ++  verification
    |=  v=verification-message
    ^-  json
    %-  pairs
    :~  ['id' s+(scot %uv id.v)]
        ['aliasId' s+(scot %uv alias-id.v)]
        ['from' (sect from.v)]
        ['subject' (sect subject.v)]
        ['code' ?~(code.v ~ (sect u.code.v))]
        ['link' ?~(link.v ~ (sect u.link.v))]
        ['received' (sect (scot %da received.v))]
    ==
  ::
  ++  cf-conf
    |=  c=cf-config
    ^-  json
    %-  pairs
    :~  ['domain' (sect domain.c)]
        ['zoneId' (sect zone-id.c)]
        ['kvId' (sect kv-id.c)]
        ['workerUrl' (sect worker-url.c)]
        ['workerSecret' (sect worker-secret.c)]
        ['configured' b+configured.c]
    ==
  ::
  ++  sect
    |=  t=@t
    ^-  json
    s+t
  --
::
::  JSON deserialization helpers
::
++  dejs
  =,  dejs:format
  |%
  ++  uv-id
    |=  jon=json
    ^-  @uvH
    ?>  ?=(%s -.jon)
    `@uvH`(slav %uv p.jon)
  ::
  ++  action
    |=  jon=json
    ^-  ^action
    %.  jon
    %-  of
    :~  [%create-cloak (ot ~[service+so label+so])]
        [%burn-cloak (ot ~[id+uv-id])]
        [%set-cf-config (ot ~[domain+so api-token+so account-id+so])]
        [%setup-cloudflare ul]
        [%set-worker-url (ot ~[url+so])]
        [%generate-token (ot ~[label+so])]
        [%revoke-token (ot ~[id+uv-id])]
        [%store-verification (ot ~[alias-id+uv-id code+so])]
        [%request-credentials (ot ~[id+uv-id])]
    ==
  --
--
