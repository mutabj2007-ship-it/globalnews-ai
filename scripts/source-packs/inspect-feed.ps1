$ErrorActionPreference = 'Stop'
try {
  $settings = [System.Xml.XmlReaderSettings]::new()
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver = $null
  $inputText = [Console]::In.ReadToEnd()
  $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($inputText), $settings)
  $doc = [System.Xml.XmlDocument]::new()
  $doc.XmlResolver = $null
  $doc.Load($reader)
  $rootName = $doc.DocumentElement.LocalName
  if ($rootName -notin @('rss', 'feed', 'RDF')) { throw 'NOT_A_FEED_ROOT' }
  $items = @($doc.SelectNodes('//*[local-name()="item" or local-name()="entry"]'))
  $samples = @($items | Select-Object -First 3 | ForEach-Object {
    $linkNode = $_.SelectSingleNode('./*[local-name()="link" and (not(@rel) or @rel="alternate")]')
    $dateNode = $_.SelectSingleNode('./*[local-name()="pubDate" or local-name()="published" or local-name()="updated" or local-name()="date"]')
    $titleNode = $_.SelectSingleNode('./*[local-name()="title"]')
    [ordered]@{ link = $(if ($linkNode.HasAttribute('href')) { $linkNode.GetAttribute('href') } else { $linkNode.InnerText }); date = $dateNode.InnerText; hasTitle = -not [string]::IsNullOrWhiteSpace($titleNode.InnerText) }
  })
  $language = $doc.SelectSingleNode('//*[local-name()="channel"]/*[local-name()="language"]')
  [ordered]@{ parsed = $true; root = $rootName; itemCount = $items.Count; language = $language.InnerText; items = $samples } | ConvertTo-Json -Depth 5 -Compress
} catch {
  [ordered]@{ parsed = $false; error = $_.Exception.Message.Substring(0, [Math]::Min(160, $_.Exception.Message.Length)) } | ConvertTo-Json -Compress
}
