/-  *cloak
/+  *cloak
|_  upd=update
++  grab
  |%
  ++  noun  update
  --
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    ^-  ^json
    ?-  -.upd
      %cloak-created
        %-  pairs
        :~  ['type' s+'cloakCreated']
            ['identity' (identity:enjs cloaked-identity.upd)]
            ['alias' (ali:enjs alias.upd)]
            ['credential' (cred:enjs credential.upd)]
        ==
      %cloak-burned
        %-  pairs
        :~  ['type' s+'cloakBurned']
            ['id' (numb `@ud`id.upd)]
        ==
      %cf-configured
        %-  pairs
        :~  ['type' s+'cfConfigured']
            ['config' (cf-conf:enjs cf-config.upd)]
        ==
      %token-generated
        %-  pairs
        :~  ['type' s+'tokenGenerated']
            ['token' (token:enjs api-token.upd)]
        ==
      %token-revoked
        %-  pairs
        :~  ['type' s+'tokenRevoked']
            ['id' (numb `@ud`id.upd)]
        ==
      %verification-received
        %-  pairs
        :~  ['type' s+'verificationReceived']
            ['message' (verification:enjs verification-message.upd)]
        ==
      %credentials-response
        %-  pairs
        :~  ['type' s+'credentialsResponse']
            ['credential' (cred:enjs credential.upd)]
        ==
    ==
  --
++  grad  %noun
--
