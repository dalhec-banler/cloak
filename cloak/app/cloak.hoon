/-  *cloak
/+  *cloak, default-agent, dbug
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      identities=(map identity-id cloaked-identity)
      aliases=(map alias-id alias)
      credentials=(map cred-id credential)
      messages=(map message-id verification-message)
      cf=(unit cf-config)
      tokens=(map token-id api-token)
  ==
+$  versioned-state  $%(state-0)
--
%-  agent:dbug
=|  state-0
=*  state  -
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def  ~(. (default-agent this %|) bowl)
::
++  on-init
  :_  this
  :~  [%pass /bind-api %arvo %e %connect [~ /cloak-api] %cloak]
  ==
::
++  on-save  !>(state)
::
++  on-load
  |=  old-vase=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-vase)
  ?-  -.old
      %0
    :_  this(state old)
    :~  [%pass /bind-api %arvo %e %connect [~ /cloak-api] %cloak]
    ==
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  |^
  ?+  mark  (on-poke:def mark vase)
      %cloak-action
    =/  a  !<(action vase)
    ?>  =(our.bowl src.bowl)
    =^  cards=(list card)  state
      (handle-action a)
    [cards this]
  ::
      %handle-http-request
    (handle-http !<([@ta inbound-request:eyre] vase))
  ==
  ::
  ++  handle-action
    |=  a=action
    ^-  (quip card _state)
    ?-  -.a
    ::
    ::  create a new cloaked identity
    ::
        %create-cloak
      =/  dom=@t
        ?~  cf  !!
        domain.u.cf
      =/  iid=identity-id    (make-id eny.bowl)
      =/  aid=alias-id       (make-id (sham [eny.bowl 'alias']))
      =/  cid=cred-id        (make-id (sham [eny.bowl 'cred']))
      =/  addr=@t            (make-alias-address service.a dom (sham [eny.bowl 'addr']))
      =/  pass=@t            (make-password (sham [eny.bowl 'pass']))
      =/  ci=cloaked-identity
        :*  id=iid
            service=service.a
            label=label.a
            status=%active
            alias-id=aid
            cred-id=cid
            created=now.bowl
            burned=~
        ==
      =/  al=alias
        :*  id=aid
            address=addr
            identity-id=iid
            service=service.a
            status=%active
        ==
      =/  cr=credential
        :*  id=cid
            identity-id=iid
            username=addr
            password=pass
            created=now.bowl
        ==
      =/  new-state
        %_  state
          identities  (~(put by identities) iid ci)
          aliases     (~(put by aliases) aid al)
          credentials (~(put by credentials) cid cr)
        ==
      :-  (fact-update [%cloak-created ci al cr])
      new-state
    ::
    ::  burn (revoke) a cloaked identity
    ::
        %burn-cloak
      ?.  (~(has by identities) id.a)  `state
      =/  ci  (~(got by identities) id.a)
      =/  burned-ci  ci(status %burned, burned `now.bowl)
      =/  burned-al  (~(got by aliases) alias-id.ci)
      =/  new-state
        %_  state
          identities  (~(put by identities) id.a burned-ci)
          aliases     (~(put by aliases) alias-id.ci burned-al(status %burned))
        ==
      :-  (fact-update [%cloak-burned id.a])
      new-state
    ::
    ::  store cloudflare configuration
    ::
        %set-cf-config
      =/  new-cf=cf-config
        :*  domain=domain.a
            api-token=api-token.a
            account-id=account-id.a
            worker-url=''
            worker-secret=''
            configured=%.n
        ==
      `state(cf `new-cf)
    ::
    ::  trigger cloudflare setup via %iris
    ::  step 1: look up zone ID for the domain
    ::
        %setup-cloudflare
      ?~  cf  !!
      =/  wsec=@t  (scot %uv (sham eny.bowl))
      =/  new-cf  u.cf(worker-secret wsec)
      =/  url=@t
        (crip (weld "https://api.cloudflare.com/client/v4/zones?name=" (trip domain.u.cf)))
      :_  state(cf `new-cf)
      :~  (cf-request /cf-setup/zone-lookup url %'GET' ~)
      ==
    ::
    ::  generate extension API token
    ::
        %generate-token
      =/  tid=token-id  (make-id eny.bowl)
      =/  tok=@t        (scot %uv (sham [eny.bowl 'token']))
      =/  at=api-token
        :*  id=tid
            token=tok
            label=label.a
            created=now.bowl
            last-used=now.bowl
        ==
      :-  (fact-update [%token-generated at])
      state(tokens (~(put by tokens) tid at))
    ::
    ::  revoke extension API token
    ::
        %revoke-token
      ?.  (~(has by tokens) id.a)  `state
      :-  (fact-update [%token-revoked id.a])
      state(tokens (~(del by tokens) id.a))
    ::
    ::  store a verification code from the extension
    ::
        %store-verification
      ?.  (~(has by aliases) alias-id.a)  `state
      =/  mid=message-id  (make-id eny.bowl)
      =/  vm=verification-message
        :*  id=mid
            alias-id=alias-id.a
            from=''
            subject=''
            code=`code.a
            link=~
            raw=''
            received=now.bowl
        ==
      :-  (fact-update [%verification-received vm])
      state(messages (~(put by messages) mid vm))
    ::
    ::  request credentials for an identity (extension use)
    ::
        %request-credentials
      ?.  (~(has by identities) id.a)  `state
      =/  ci  (~(got by identities) id.a)
      =/  cr  (~(got by credentials) cred-id.ci)
      :-  (fact-update [%credentials-response cr])
      state
    ==
  ::
  ::  HTTP request handler for extension API
  ::
  ++  handle-http
    |=  [rid=@ta req=inbound-request:eyre]
    ^-  (quip card _this)
    =/  url=request-line:server
      (parse-request-line:server url.request.req)
    =/  auth-ok=?
      =/  auth-header=(unit @t)
        =/  headers=(list [key=@t value=@t])  header-list.request.req
        |-
        ?~  headers  ~
        ?:  =(key.i.headers 'authorization')
          `value.i.headers
        $(headers t.headers)
      ?~  auth-header  %.n
      =/  tok=@t  u.auth-header
      =/  token-list=(list api-token)  ~(val by tokens)
      |-
      ?~  token-list  %.n
      ?:  =(token.i.token-list tok)  %.y
      $(token-list t.token-list)
    ::
    ?.  auth-ok
      :_  this
      (give-http rid 401 (some (as-octs:mimes:html '{"error":"unauthorized"}')))
    ::
    ?+  site.url
      :_  this
      (give-http rid 404 (some (as-octs:mimes:html '{"error":"not found"}')))
    ::
        [%cloak-api %identities ~]
      =/  id-list=(list json)
        (turn ~(val by identities) identity:enjs)
      :_  this
      (give-http rid 200 (some (as-octs:mimes:html (en:json:html a+id-list))))
    ::
        [%cloak-api %identity @t ~]
      =/  id-cord=@t  i.t.t.site.url
      =/  id=identity-id  `@uvH`(slav %uv id-cord)
      ?.  (~(has by identities) id)
        :_  this
        (give-http rid 404 (some (as-octs:mimes:html '{"error":"not found"}')))
      =/  ci  (~(got by identities) id)
      =/  al  (~(got by aliases) alias-id.ci)
      =/  cr  (~(got by credentials) cred-id.ci)
      =/  res=json
        %-  pairs:enjs:format
        :~  ['identity' (identity:enjs ci)]
            ['alias' (ali:enjs al)]
            ['credential' (cred:enjs cr)]
        ==
      :_  this
      (give-http rid 200 (some (as-octs:mimes:html (en:json:html res))))
    ::
        [%cloak-api %match @t ~]
      =/  domain=@t  i.t.t.site.url
      =/  match=(unit cloaked-identity)
        =/  id-list=(list cloaked-identity)  ~(val by identities)
        |-
        ?~  id-list  ~
        ?:  &(=(service.i.id-list domain) ?=(%active status.i.id-list))
          `i.id-list
        $(id-list t.id-list)
      ?~  match
        :_  this
        (give-http rid 404 (some (as-octs:mimes:html '{"error":"no match"}')))
      =/  ci  u.match
      =/  al  (~(got by aliases) alias-id.ci)
      =/  cr  (~(got by credentials) cred-id.ci)
      =/  res=json
        %-  pairs:enjs:format
        :~  ['identity' (identity:enjs ci)]
            ['alias' (ali:enjs al)]
            ['credential' (cred:enjs cr)]
        ==
      :_  this
      (give-http rid 200 (some (as-octs:mimes:html (en:json:html res))))
    ::
        [%cloak-api %config ~]
      =/  res=json
        ?~  cf  s+'unconfigured'
        (cf-conf:enjs u.cf)
      :_  this
      (give-http rid 200 (some (as-octs:mimes:html (en:json:html res))))
    ::
        [%cloak-api %tokens ~]
      =/  tok-list=(list json)
        %+  turn  ~(val by tokens)
        |=  t=api-token
        ::  don't expose the actual token value in list view
        %-  pairs:enjs:format
        :~  ['id' (numb:enjs:format `@ud`id.t)]
            ['label' s+label.t]
            ['created' s+(scot %da created.t)]
            ['lastUsed' s+(scot %da last-used.t)]
        ==
      :_  this
      (give-http rid 200 (some (as-octs:mimes:html (en:json:html a+tok-list))))
    ==
  ::
  ++  give-http
    |=  [rid=@ta code=@ud body=(unit octs)]
    ^-  (list card)
    =/  content-type  ['content-type' 'application/json']
    =/  cors          ['access-control-allow-origin' '*']
    =/  headers       ~[content-type cors]
    :~  [%give %fact ~[/http-response/[rid]] %http-response-header !>([code headers])]
        [%give %fact ~[/http-response/[rid]] %http-response-data !>(body)]
        [%give %kick ~[/http-response/[rid]] ~]
    ==
  --
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
      [%updates ~]
    ?>  =(our.bowl src.bowl)
    `this
  ::
      [%http-response *]
    `this
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
      [%x %identities ~]
    =/  id-list=(list json)
      (turn ~(val by identities) identity:enjs)
    ``json+!>(a+id-list)
  ::
      [%x %identity @t ~]
    =/  id=identity-id  `@uvH`(slav %uv i.t.t.path)
    ?.  (~(has by identities) id)  ~
    =/  ci  (~(got by identities) id)
    ``json+!>((identity:enjs ci))
  ::
      [%x %aliases ~]
    =/  al-list=(list json)
      (turn ~(val by aliases) ali:enjs)
    ``json+!>(a+al-list)
  ::
      [%x %cf-config ~]
    =/  res=json
      ?~  cf  s+'unconfigured'
      (cf-conf:enjs u.cf)
    ``json+!>(res)
  ::
      [%x %tokens ~]
    =/  tok-list=(list json)
      (turn ~(val by tokens) token:enjs)
    ``json+!>(a+tok-list)
  ::
      [%x %messages @t ~]
    =/  aid=alias-id  `@uvH`(slav %uv i.t.t.path)
    =/  msg-list=(list json)
      %+  turn
        %+  skim  ~(val by messages)
        |=(v=verification-message =(alias-id.v aid))
      verification:enjs
    ``json+!>(a+msg-list)
  ==
::
++  on-agent  on-agent:def
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%bind-api ~]
    `this
  ::
  ::  cloudflare setup — multi-step %iris chain
  ::
      [%cf-setup %zone-lookup ~]
    ?>  ?=([%iris %http-response %finished *] sign-arvo)
    ?~  full-file.client-response.sign-arvo  `this
    =/  body=@t  q.data.u.full-file.client-response.sign-arvo
    =/  jon=(unit json)  (de:json:html body)
    ?~  jon  `this
    =/  result  u.jon
    ::  extract zone ID from response: {"result":[{"id":"..."}]}
    =/  zone-id=(unit @t)
      =/  res=(unit json)  (~(get by ?>(?=(%o -.result) p.result)) 'result')
      ?~  res  ~
      ?.  ?=(%a -.u.res)  ~
      ?~  p.u.res  ~
      ?.  ?=(%o -.i.p.u.res)  ~
      =/  id-json=(unit json)  (~(get by p.i.p.u.res) 'id')
      ?~  id-json  ~
      ?.  ?=(%s -.u.id-json)  ~
      `p.u.id-json
    ?~  zone-id  `this
    ::  step 2: set MX records for email routing
    ?~  cf  `this
    =/  mx-url=@t
      (crip (weld "https://api.cloudflare.com/client/v4/zones/" (weld (trip u.zone-id) "/dns_records")))
    =/  mx-body=@t
      (crip (weld "{\"type\":\"MX\",\"name\":\"" (weld (trip domain.u.cf) "\",\"content\":\"route1.mx.cloudflare.net\",\"priority\":36,\"ttl\":1}")))
    :_  this
    :~  (cf-request /cf-setup/mx-record/(scot %t u.zone-id) mx-url %'POST' `mx-body)
    ==
  ::
      [%cf-setup %mx-record @t ~]
    ?>  ?=([%iris %http-response %finished *] sign-arvo)
    =/  zone-id=@t  (slav %t i.t.t.wire)
    ?~  cf  `this
    ::  step 3: create KV namespace
    =/  kv-url=@t
      (crip (weld "https://api.cloudflare.com/client/v4/accounts/" (weld (trip account-id.u.cf) "/storage/kv/namespaces")))
    =/  kv-body=@t  '{"title":"cloak-mail"}'
    :_  this
    :~  (cf-request /cf-setup/kv-create/(scot %t zone-id) kv-url %'POST' `kv-body)
    ==
  ::
      [%cf-setup %kv-create @t ~]
    ?>  ?=([%iris %http-response %finished *] sign-arvo)
    =/  zone-id=@t  (slav %t i.t.t.wire)
    ?~  full-file.client-response.sign-arvo  `this
    =/  body=@t  q.data.u.full-file.client-response.sign-arvo
    =/  jon=(unit json)  (de:json:html body)
    ?~  jon  `this
    ::  extract KV namespace ID from response
    =/  kv-id=(unit @t)
      =/  res=(unit json)  (~(get by ?>(?=(%o -.u.jon) p.u.jon)) 'result')
      ?~  res  ~
      ?.  ?=(%o -.u.res)  ~
      =/  id-json=(unit json)  (~(get by p.u.res) 'id')
      ?~  id-json  ~
      ?.  ?=(%s -.u.id-json)  ~
      `p.u.id-json
    ?~  kv-id  `this
    ?~  cf  `this
    ::  step 4: deploy worker with KV binding
    =/  worker-url=@t
      (crip (weld "https://api.cloudflare.com/client/v4/accounts/" (weld (trip account-id.u.cf) "/workers/scripts/cloak-mail")))
    ::  worker script is deployed from the frontend as a separate step
    ::  for now, mark setup as configured with the worker URL pattern
    =/  wurl=@t
      (crip (weld "https://cloak-mail." (weld (trip account-id.u.cf) ".workers.dev")))
    =/  new-cf  u.cf(worker-url wurl, configured %.y)
    :-  (fact-update [%cf-configured new-cf])
    this(cf `new-cf)
  ==
::
++  on-leave  on-leave:def
++  on-fail   on-fail:def
::
::  helper: emit update fact on /updates path
::
++  fact-update
  |=  upd=update
  ^-  (list card)
  :~  [%give %fact ~[/updates] %cloak-update !>(upd)]
  ==
::
::  helper: build an authenticated %iris request to Cloudflare API
::
++  cf-request
  |=  [=wire url=@t method=@t body=(unit @t)]
  ^-  card
  ?~  cf  !!
  =/  headers=(list [key=@t value=@t])
    :~  ['Authorization' (crip (weld "Bearer " (trip api-token.u.cf)))]
        ['Content-Type' 'application/json']
    ==
  =/  bod=(unit octs)
    ?~  body  ~
    `(as-octs:mimes:html u.body)
  [%pass wire %arvo %i %request [method url headers bod]]
--
