import React from 'react';
import brace from 'brace';
import AceEditor from 'react-ace';

import 'brace/mode/xml';
import 'brace/theme/twilight';

// See https://github.com/securingsincity/react-ace
export default class XMLView extends React.Component {
  // TODO: Merge this with markdownview.
  getValue() {
    if (this.ace) {
      return this.ace.editor.getValue();
    }
    return "";
  }

  setValue(value) {
    if (this.ace) {
      this.ace.editor.setValue(value);
    }
  }

  render() {
    return (
      <AceEditor
        ref={(ref) => this.ace = ref}
        mode="xml"
        theme="twilight"
        fontSize={20}
        onChange={this.props.onChange}
        width="100%"
        height="100%"
        name="xml-editor"
        value={this.getValue()}
        editorProps={{$blockScrolling: true}}
      />
    );
  }
}