|%
+$  identity-id   @uvH
+$  alias-id      @uvH
+$  cred-id       @uvH
+$  message-id    @uvH
+$  token-id      @uvH
+$  cloak-status  ?(%active %burned)
::
::  core identity — one per service
::
+$  cloaked-identity
  $:  id=identity-id
      service=@t
      label=@t
      status=cloak-status
      =alias-id
      =cred-id
      created=@da
      burned=(unit @da)
  ==
::
::  email alias — one per identity
::
+$  alias
  $:  id=alias-id
      address=@t
      =identity-id
      service=@t
      status=cloak-status
  ==
::
::  login credentials — one per identity
::
+$  credential
  $:  id=cred-id
      =identity-id
      username=@t
      password=@t
      created=@da
  ==
::
::  inbound verification message
::
+$  verification-message
  $:  id=message-id
      =alias-id
      from=@t
      subject=@t
      code=(unit @t)
      link=(unit @t)
      raw=@t
      received=@da
  ==
::
::  cloudflare configuration
::
+$  cf-config
  $:  domain=@t
      api-token=@t
      account-id=@t
      zone-id=@t
      kv-id=@t
      worker-url=@t
      worker-secret=@t
      configured=?
  ==
::
::  extension API token
::
+$  api-token
  $:  id=token-id
      token=@t
      label=@t
      created=@da
      last-used=@da
  ==
::
::  actions (pokes)
::
+$  action
  $%  ::  identity management
      [%create-cloak service=@t label=@t]
      [%burn-cloak id=identity-id]
      ::  cloudflare setup
      [%set-cf-config domain=@t api-token=@t account-id=@t]
      [%setup-cloudflare ~]
      [%set-worker-url url=@t]
      ::  extension auth
      [%generate-token label=@t]
      [%revoke-token id=token-id]
      ::  verification
      [%store-verification =alias-id code=@t]
      ::  extension credential request
      [%request-credentials id=identity-id]
  ==
::
::  updates (subscription facts)
::
+$  update
  $%  [%cloak-created =cloaked-identity =alias =credential]
      [%cloak-burned id=identity-id]
      [%cf-configured =cf-config]
      [%cf-setup-error msg=@t]
      [%token-generated =api-token]
      [%token-revoked id=token-id]
      [%verification-received =verification-message]
      [%credentials-response =credential]
  ==
--
