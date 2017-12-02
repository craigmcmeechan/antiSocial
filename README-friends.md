## antiSocial Friend Protocol

At the end of this protocol both users will have a Friend record holding the accessToken and the public key of the friend. With these credentials they can exchange signed encrypted messages for notifying each other of activity in their accounts.

`accessToken` is a uuid that is used to authenticate connection requests, `requestToken` is a uuid which is used to retrieve an accessToken

Friend Table Definition:
[common/models/Friend.json](https://github.com/antiSocialNet/antiSocial/blob/master/common/models/friend.json)

Protocol implementation:
[server/boot/friend-protocol.js](https://github.com/antiSocialNet/antiSocial/blob/master/common/models/friend.json)

Encryption:
[server/lib/encryption.js](https://github.com/antiSocialNet/antiSocial/blob/master/server/lib/encryption.js)


### Friend Request
---

Use case: Michael wants to friend Alan and already knows the address of Alan's server endpoint.
`http://emtage.com/alan`

Michael logs on to his account on his server.
`http://rhodes.com/friends`

Michael enters Alan's address on the friend request form.

Alan's public profile information is displayed to confirm that the address is correct.

Michael clicks the 'add friend' button which starts the friend request protocol.

### FRIEND REQUEST
---

1. Michael's server creates a 'Friend' record in his database marking it as 'pending' and setting the flag 'originator' to indicate that Michael is making the request. This record has a unique 'requestToken', 'accessToken' and an RSA key pair. These credentials will be exchanged with Alan's server.
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

GET --------------------->
http://rhodes.com/friend?endpoint=http://emtage.com/alan
```

2. Michael's server sends a POST request to Alan's server to initiate the friend request.
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          POST -------------------->
                          http://emtage.com/alan/friend-request
                          BODY {
                            'remoteEndPoint': 'http://rhodes.com/michael',
                            'requestToken': Michaels Request Token
                          }
```
3. Alans's server connects to Michael's server to validate the origin of the request and to exchange Michael's requestToken for an accessToken.
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          <------------------------ POST
                                                    http://rhodes.com/michael/friend-exchange
                                                    BODY {
                                                      'endpoint': 'http://emtage.com/alan',
                                                      'requestToken': Michaels Request Token
                                                    }
```
4. Michael's server looks up the friend record and returns access credentials to Alan's server
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          RESPONSE ---------------->
                          {
                            'status': 'ok',
                            'accessToken': Michael's Access Token,
                            'publicKey': Michael's public key
                          }
```
5. Alan's server creates a 'Friend' record in his database marking it as 'pending' saving Michael's accessToken and the publicKey and notifies Alan of the pending request. Alan's server returns his requestToken to Michael's server so Micael's server can complete the exchange of credentials.
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          <------------------------ RESPONSE
                                                    {
                                                     'status': 'ok',
                                                     'requestToken': Alan's RequestToken
                                                    }
```
6. Michael's server connects to Alan's server to exchange Alan's request token for an accessToken
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          POST ------------------->
                          http://emtage.com/alan/friend-exchange
                          BODY {
                           'endpoint': http://rhodes.com/mr,
                           'requestToken': Alan's Request Token
                          }
```
7. Alan's server looks up the friend record by the requestToken and returns access credentials to Michael's server
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          <------------------------ RESPONSE
                                                    {
                                                      'status': 'ok',
                                                      'accessToken': Alan's AccessToken,
                                                      'publicKey': Alan's public key
                                                    }
```

8. Michael's server saves Alan's accessToken and the publicKey in the pending Friend record and returns status to the client.
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

<------------------------ RESPONSE
                          { 'status':'ok' }
```

### FRIEND ACCEPT
---

1. Alan accepts friend Michael's request by clicking the button in the UI calling the accept-friend endpoint
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                                                    <----------------------- GET
                                                                             http://emtage.com/accept-friend?endpoint=http://rhodes.com/mr
```

2. Alan's server marks the Friend record as 'accepted' and sends a POST request to Michael's server to notify him that his friend request was accepted
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          <------------------------ POST
                                                    http://rhodes.com/mr/friend-webhook/friend-request-accepted
                                                    BODY {
                                                      'accessToken': Michael's access token
                                                    }
```

3.Michael's server marks the Friend record as 'accepted'
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------

                          RESPONSE ---------------->
                          { 'status':'ok' }
```

4. Alan's server returns status to the client.
```
Michael's Browser         Michael's server           Alan's server            Alan's Browser
-----------------         ----------------          ----------------         ----------------


                                                    RESPONSE --------------->
                                                    { 'status':'ok' }
```
