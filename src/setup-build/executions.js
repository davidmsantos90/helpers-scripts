import { echo, rm } from 'shelljs'
import { readFile, writeFile } from 'fs'

import setupBuildUtils from './utils'
import { download, extract, cleanup } from './commands'

const SERVER_ARTIFACT = 'pentaho-server-ee'
const PDI_ARTIFACT = 'pdi-ee-client'
const ANALYZER_ARTIFACT = 'paz-plugin-ee'

const newline = (message) => {
  if (message != null) echo(message)
  echo('')
}

const readWriteFile = ({ file, placeholder, valueToReplace }) => new Promise((resolve, reject) => {
  const fileSettings = { encoding: 'utf8' }

  const updateData = (data) => {
    if (!data.includes(valueToReplace)) {
      data = data.replace(placeholder, valueToReplace)
    }

    return data
  }

  readFile(file, fileSettings, (error, data) => {
    if (error) return reject(error)

    const newData = updateData(data);
    if (newData === data) {
      return resolve()
    }

    writeFile(file, newData, fileSettings, (error) => {
      if (error) return reject(error)

      resolve()
    })
  })
})

const disableFirstBootPrompt = (pentahoServerFolder) => {
  const promptUserFiles = setupBuildUtils.join(pentahoServerFolder, 'promptuser.*')

  rm('-f', promptUserFiles)

  return Promise.resolve()
}

const enableSpoonDebug = (dataIntegrationFolder) => {
  const file = setupBuildUtils.join(dataIntegrationFolder, 'spoon.sh')

  const placeholder = '# optional line for attaching a debugger'

  const debugSpoon = 'OPT="$OPT -Xdebug -Xnoagent -Djava.compiler=NONE -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"'
  const valueToReplace = `${ placeholder }\n${ debugSpoon }`

  return readWriteFile({ file, placeholder, valueToReplace })
}

const enableKarafFeatures = (karafEtcFolder) => {
  const file = setupBuildUtils.join(karafEtcFolder, 'org.apache.karaf.features.cfg')

  const placeholder = 'featuresBoot='

  const featuresToAdd = 'ssh,pentaho-marketplace,'
  const valueToReplace = `${ placeholder + featuresToAdd}`

  return readWriteFile({ file, placeholder, valueToReplace })
}

const enableLocalDevDependencies = (karafEtcFolder) => {
  const file = setupBuildUtils.join(karafEtcFolder, 'org.ops4j.pax.url.mvn.cfg')

  const placeholder = 'org.ops4j.pax.url.mvn.localRepository='

  const commentToEnable = '# '
  const valueToReplace = `${ commentToEnable + placeholder }`

  return readWriteFile({ file, placeholder, valueToReplace })
}

// ----

const pdiDownload = () => {
  const downloadPdi = () => download({
    link: setupBuildUtils.downloadLink(PDI_ARTIFACT),
    destination: setupBuildUtils.downloadOutput(PDI_ARTIFACT)
  })

  return Promise.all([
    downloadPdi()
  ]).then(() => newline())
}

const serverDownload = () => {
  const downloadServer = () => download({
    link: setupBuildUtils.downloadLink(SERVER_ARTIFACT),
    destination: setupBuildUtils.downloadOutput(SERVER_ARTIFACT)
  })

  const downloadAnalyzer = () => download({
    link: setupBuildUtils.downloadLink(ANALYZER_ARTIFACT),
    destination: setupBuildUtils.downloadOutput(ANALYZER_ARTIFACT)
  })

  return Promise.all([
    downloadServer(),
    downloadAnalyzer()
  ]).then(() => newline())
}

// ---

const pdiExtract = () => {
  const extractPdi = () => extract({
    source: setupBuildUtils.extractSource(PDI_ARTIFACT),
    destination: setupBuildUtils.extractOutput(PDI_ARTIFACT)
  })

  return Promise.all([
    extractPdi()
  ]).then(() => newline())
}

const serverExtract = () => {
  const {
    base: serverOutputFolder,
    system: pentahoSystemFolder
  } = setupBuildUtils.serverFolders(SERVER_ARTIFACT)

  const extractServer = () => extract({
    source: setupBuildUtils.extractSource(SERVER_ARTIFACT),
    destination: serverOutputFolder
  })

  const extractAnalyzer = () => extract({
    source: setupBuildUtils.extractSource(ANALYZER_ARTIFACT),
    destination: pentahoSystemFolder,
    pluginName: 'analyzer'
  })

  return Promise.all([
    extractServer(),
    extractAnalyzer()
  ]).then(() => newline())
}

// ---

const pdiCleanup = () => {
  const {
    base: pdiFolder,
    scripts: pdiDataIntegrationFolder,
    karafEtc: pdiKarafEtcFolder
  } = setupBuildUtils.pdiFolders(PDI_ARTIFACT)

  return cleanup({
    source: pdiFolder,
    actions: () => [
      enableSpoonDebug(pdiDataIntegrationFolder),
      enableKarafFeatures(pdiKarafEtcFolder),
      enableLocalDevDependencies(pdiKarafEtcFolder)
    ]
  })
}

const serverCleanup = () => {
  const {
    base: serverFolder,
    scripts: serverPentahoServerFolder,
    karafEtc: serverKarafEtcFolder
  } = setupBuildUtils.serverFolders(SERVER_ARTIFACT)

  return cleanup({
    source: serverFolder,
    actions: () => [
      disableFirstBootPrompt(serverPentahoServerFolder),
      enableKarafFeatures(serverKarafEtcFolder),
      enableLocalDevDependencies(serverKarafEtcFolder)
    ]
  })
}

// ---

export const server = () => serverDownload().then(() => serverExtract()).then(() => serverCleanup())
  .then((message) => newline(message))
  .catch((error) => newline(error))

export const pdi = () => pdiDownload().then(() => pdiExtract()).then(() => pdiCleanup())
  .then((message) => newline(message))
  .catch((error) => newline(error))