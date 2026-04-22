/-  *cloak
/+  *cloak, default-agent, dbug, server
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
    ?-  -.a
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
        :-  (upd-fact [%cloak-created ci al cr])
        this(identities (~(put by identities) iid ci), aliases (~(put by aliases) aid al), credentials (~(put by credentials) cid cr))
    ::
      %burn-cloak
        ?.  (~(has by identities) id.a)  `this
        =/  ci  (~(got by identities) id.a)
        =/  burned-ci  ci(status %burned, burned `now.bowl)
        =/  burned-al  (~(got by aliases) alias-id.ci)
        :-  (upd-fact [%cloak-burned id.a])
        this(identities (~(put by identities) id.a burned-ci), aliases (~(put by aliases) alias-id.ci burned-al(status %burned)))
    ::
      %set-cf-config
        =/  new-cf=cf-config
          :*  domain=domain.a
              api-token=api-token.a
              account-id=account-id.a
              zone-id=''
              kv-id=''
              worker-url=''
              worker-secret=''
              configured=%.n
          ==
        `this(cf `new-cf)
    ::
      %setup-cloudflare
        ?~  cf  !!
        =/  wsec=@t  (scot %uv (sham eny.bowl))
        =/  new-cf  u.cf(worker-secret wsec)
        =/  url=@t
          (cat 3 'https://api.cloudflare.com/client/v4/zones?name=' domain.u.cf)
        =/  =request:http
          [method=%'GET' url=url header-list=(cf-headers api-token.u.cf) body=~]
        :-  ~[[%pass /cf-setup/zone-lookup %arvo %i %request request ~]]
        this(cf `new-cf)
    ::
      %set-worker-url
        ?~  cf  !!
        =/  new-cf  u.cf(worker-url url.a)
        :-  (upd-fact [%cf-configured new-cf])
        this(cf `new-cf)
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
        :-  (upd-fact [%token-generated at])
        this(tokens (~(put by tokens) tid at))
    ::
      %revoke-token
        ?.  (~(has by tokens) id.a)  `this
        :-  (upd-fact [%token-revoked id.a])
        this(tokens (~(del by tokens) id.a))
    ::
      %store-verification
        ?.  (~(has by aliases) alias-id.a)  `this
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
        :-  (upd-fact [%verification-received vm])
        this(messages (~(put by messages) mid vm))
    ::
      %request-credentials
        ?.  (~(has by identities) id.a)  `this
        =/  ci  (~(got by identities) id.a)
        =/  cr  (~(got by credentials) cred-id.ci)
        :-  (upd-fact [%credentials-response cr])
        this
    ==
  ::
      %handle-http-request
    (handle-http !<([@ta inbound-request:eyre] vase))
  ==
  ::
  ++  upd-fact
    |=  upd=update
    ^-  (list card)
    :~  [%give %fact ~[/updates] %cloak-update !>(upd)]
    ==
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
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  |^
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%bind-api ~]
    `this
  ::
  ::  cloudflare setup step 1: zone lookup response
  ::
      [%cf-setup %zone-lookup ~]
    =/  jon=(unit json)  (parse-iris-body sign-arvo)
    ?~  jon
      ~&  %cf-zone-lookup-failed
      :-  (upd-fact [%cf-setup-error 'zone lookup failed - no response'])
      this
    =/  zid=(unit @t)  (get-zone-id u.jon)
    ?~  zid
      ~&  %cf-zone-not-found
      :-  (upd-fact [%cf-setup-error 'domain not found in cloudflare account'])
      this
    ?~  cf  `this
    ::  store zone-id and fire KV namespace creation
    =/  new-cf  u.cf(zone-id u.zid)
    =/  url=@t
      %+  cat  3
        (cat 3 'https://api.cloudflare.com/client/v4/accounts/' account-id.u.cf)
      '/storage/kv/namespaces'
    =/  body=@t  '{"title":"CLOAK_KV"}'
    =/  =request:http
      :*  method=%'POST'
          url=url
          header-list=(cf-headers api-token.u.cf)
          body=(some (as-octs:mimes:html body))
      ==
    :-  ~[[%pass /cf-setup/kv-create %arvo %i %request request ~]]
    this(cf `new-cf)
  ::
  ::  cloudflare setup step 2: KV namespace created
  ::
      [%cf-setup %kv-create ~]
    =/  jon=(unit json)  (parse-iris-body sign-arvo)
    ?~  jon
      ~&  %cf-kv-create-failed
      :-  (upd-fact [%cf-setup-error 'kv namespace creation failed'])
      this
    =/  kid=(unit @t)  (get-result-id u.jon)
    ?~  kid
      ~&  %cf-kv-id-missing
      :-  (upd-fact [%cf-setup-error 'could not get kv namespace id'])
      this
    ?~  cf  `this
    ::  store kv-id and fire email routing setup
    =/  new-cf  u.cf(kv-id u.kid)
    =/  url=@t
      %+  cat  3
        (cat 3 'https://api.cloudflare.com/client/v4/zones/' zone-id.u.cf)
      '/email/routing/rules'
    =/  body=@t
      '{"matchers":[{"type":"all"}],"actions":[{"type":"worker","value":["cloak-mail"]}],"enabled":true,"name":"Cloak catch-all"}'
    =/  =request:http
      :*  method=%'POST'
          url=url
          header-list=(cf-headers api-token.u.cf)
          body=(some (as-octs:mimes:html body))
      ==
    :-  ~[[%pass /cf-setup/email-route %arvo %i %request request ~]]
    this(cf `new-cf)
  ::
  ::  cloudflare setup step 3: email routing configured
  ::
      [%cf-setup %email-route ~]
    =/  jon=(unit json)  (parse-iris-body sign-arvo)
    ?~  jon
      ~&  %cf-email-route-failed
      :-  (upd-fact [%cf-setup-error 'email routing setup failed'])
      this
    ?~  cf  `this
    ::  mark as configured
    =/  new-cf  u.cf(configured %.y)
    ~&  [%cf-setup-complete domain.u.cf]
    :-  (upd-fact [%cf-configured new-cf])
    this(cf `new-cf)
  ==
  ::
  ++  upd-fact
    |=  upd=update
    ^-  (list card)
    :~  [%give %fact ~[/updates] %cloak-update !>(upd)]
    ==
  ::
  ++  parse-iris-body
    |=  =sign-arvo
    ^-  (unit json)
    ?.  ?=([%iris %http-response *] sign-arvo)  ~
    =/  =client-response:iris  +.+.sign-arvo
    ?.  ?=(%finished -.client-response)  ~
    ?~  full-file.client-response  ~
    =/  body=@t  `@t`q.q.u.full-file.client-response
    (de:json:html body)
  --
::
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--
