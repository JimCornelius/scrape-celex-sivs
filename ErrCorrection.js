export default class ErrCorrection {
  static transcriptionErrors = {
    '080903': '080930',
    '08089100': '07099100',
    '07071000': '07091000',
    '08052030.08052050.08052070.': '08052030.08052050.08052070.08052090',
    '07029070': '07020000',
    '308081020.08081050.08081090': '08081020.08081050.08081090',
    '07020005': '07070005',
    '8052011': '08052011',
    ')92041.0809': '08092041.0809',
    ')92041.08092049': '08092041.08092049',
    '193031.0809': '08093031.0809',
    '193031.08093039': '08093031.08093039',
    '0702015': '07020015',
    '0707001.0': '07070010',
    '07099073.': '07099073',
    '080810.51.08081053.': '08081051.08081053.',
    '080810.51.08081053.08081059': '08081051.08081053.08081059',
    '080.51001.0805': '08051001.0805',
    '080.51001.08051005.': '08051001.08051005.',
    '080.51001.08051005.08051009': '08051001.08051005.08051009',
    '08081092.0808109408081098': '08081092.08081094.08081098',
    'Of081092.0808': '08081092.0808',
    'Of081092.08081094.': '08081092.08081094.',
    'Of081092.08081094.08081098': '08081092.08081094.08081098',
    // '08081092.08081094.212': '',
    // part of definition on the previous line
    '08052090': 'ignore',
  };

  static ignore = {
    '32001R1179': 'Incorrectly indexed. Lnks to a regulation'
          + ' on butter. Journal listing shows CELEX 32001R1170',
    '31996R0732': 'Major problems with the OCR of this document, needs manual parsing',
  };

  static dontIgnore = {
    '32000R0404': 'Only 1 variety, but valid',
    '32000R0162': 'Only 2 varieties, but valid',
    '31995R0030': 'Only 2 varieties, but valid',
    '31995R0027': 'Only 2 varieties, but valid',
    '31995R0026': 'Only 2 varieties, but valid',
    '31995R0015': 'Only 2 varieties, but valid',
    '31995R0005': 'Only 2 varieties, but valid',
    '31995R0004': 'Only 2 varieties, but valid',
  };

  static multiVarietyDefs = {
    '31995R0063': '',
    '31995R0055': '',
    '31995R0045': '',
    '31995R0039': '',
    '31995R0030': '',
    '31995R0027': '',
    '31995R0026': '',
    '31995R0015': '',
    '31995R0005': '',
    '31995R0004': '',
  };

  static filterOut = {
    // characters picked up by OCR, that are littering the page
    'I': 'Known isolated character that block correct parsing',
    'II': 'Known characters that block correct parsing',
    'l': 'Known isolated character that block correct parsing',
    'j': 'Known isolated character that block correct parsing',
    '\\': 'Known characters that block correct parsing',
    '-': 'Known isolated character that block correct parsing',
    '»': 'Known isolated character that block correct parsing',
    '\'': 'Known isolated character that block correct parsing',
  };

  static knownDuplicateCountry = {
    '32001R1366': 'Contains duplicate for 999 on 08091000',
    '31997R1887': 'Contains duplicate for 058 on 08081092.08081094.08081098',
  };
}
