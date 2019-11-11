import Config from '../Config'

const apiCall = (method, params, options) => {
  var serializer = new TLSerialization(options)

  if (!this.connectionInited) {
    serializer.storeInt(0xda9b0d0d, 'invokeWithLayer')
    serializer.storeInt(Config.Schema.API.layer, 'layer')
    serializer.storeInt(0xc7481da6, 'initConnection')
    serializer.storeInt(Config.App.id, 'api_id')
    serializer.storeString(navigator.userAgent || 'Unknown UserAgent', 'device_model')
    serializer.storeString(navigator.platform || 'Unknown Platform', 'system_version')
    serializer.storeString(Config.App.version, 'app_version')
    serializer.storeString(navigator.language || 'en', 'system_lang_code')
    serializer.storeString('', 'lang_pack')
    serializer.storeString(navigator.language || 'en', 'lang_code')
  }

  if (options.afterMessageID) {
    serializer.storeInt(0xcb9f372d, 'invokeAfterMsg')
    serializer.storeLong(options.afterMessageID, 'msg_id')
  }

  options.resultType = serializer.storeMethod(method, params)

  var messageID = MtpTimeManager.generateID()
  var seqNo = this.generateSeqNo()
  var message = {
    msg_id: messageID,
    seq_no: seqNo,
    body: serializer.getBytes(true),
    isAPI: true
  }

  if (Config.Modes.debug) {
    console.log(dT(), 'Api call', method, params, messageID, seqNo, options)
  } else {
    console.log(dT(), 'Api call', method)
  }

  return this.pushMessage(message, options)
}