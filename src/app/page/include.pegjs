// Find include in an ejs file
// ===========================
//

// return the text of the ejs and the includes as an array
{
let textNoIncludes = '';
let includes = [];
}

opts
= opt* {
  return({text:textNoIncludes, includes:includes});
}

opt
  = include
  / ejs

// anything that isn't an include
// note that this will also include ones in comments, so you can't comment out
// an include at this point
ejs 
= (!(include) .) {
  textNoIncludes += text();
  return text()
}

include
= openDelim _ includeLitaral leftParen str:quotedString rightParen closeDelim _ {
    includes.push(str);
    if(options && options.includes && options.includes[str]) {
      textNoIncludes += options.includes[str] + '\n';
    }
}

includeLitaral
 = "include"

openDelim
 = [<] delim [-]
 
 closeDelim
 = delim [>]
 
 leftParen
 = _ [(] _

 rightParen
 = _ [)] _

 delim
 = [%]
 
quotedString
= ["] sl:stringLiteral ["] { return sl}
  / ['] sl:stringLiteral ['] {return sl}

stringLiteral
  = string:[a-zA-Z0-9_\-./]+ { return text()}

_ "whitespace"
  = [ \t\n\r]*
